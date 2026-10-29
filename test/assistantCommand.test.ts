import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import child_process from 'node:child_process';
import AssistantCommand from '../src/assistantCommand';

describe('AssistantCommand', () => {
    let originalExit: typeof process.exit;
    let originalArgv: string[];

    beforeEach(() => {
        originalExit = process.exit;
        originalArgv = process.argv;
        process.exit = jest.fn() as unknown as typeof process.exit;
    });

    afterEach(() => {
        process.exit = originalExit;
        process.argv = originalArgv;
        jest.restoreAllMocks();
    });

    test('command signature, description, options, and arguments', () => {
        const cmd = new AssistantCommand();
        expect(cmd.$signature).toBe('assistant');
        expect(cmd.$description).toBe('Run application assistant commands');
        expect(cmd.$options.length).toBe(1);
        expect(cmd.$arguments.length).toBe(1);
    });

    test('resolveAssistantPath resolves default and custom paths', () => {
        const cmd = new AssistantCommand();
        const cwd = '/my/project';

        // Default: ./assistant
        expect(cmd.resolveAssistantPath(cwd)).toBe(path.resolve(cwd, 'assistant'));
        expect(cmd.resolveAssistantPath(cwd, '')).toBe(path.resolve(cwd, 'assistant'));
        expect(cmd.resolveAssistantPath(cwd, '   ')).toBe(path.resolve(cwd, 'assistant'));

        // Relative path
        expect(cmd.resolveAssistantPath(cwd, './bin/assistant')).toBe(path.resolve(cwd, './bin/assistant'));
        expect(cmd.resolveAssistantPath(cwd, 'bin/assistant')).toBe(path.resolve(cwd, 'bin/assistant'));

        // Absolute path
        const absPath = path.resolve('/opt/assistant');
        expect(cmd.resolveAssistantPath(cwd, absPath)).toBe(absPath);
    });

    test('getForwardedArgs uses commanderArgs when provided', () => {
        const cmd = new AssistantCommand();
        const commanderArgs = ['route:list', '--json'];
        expect(cmd.getForwardedArgs(commanderArgs)).toEqual(['route:list', '--json']);
    });

    test('getForwardedArgs extracts args from process.argv fallback', () => {
        const cmd = new AssistantCommand();

        // With -f option
        process.argv = ['node', 'ostro', 'assistant', '-f', './bin/assistant', 'make:controller', 'UserController'];
        expect(cmd.getForwardedArgs()).toEqual(['make:controller', 'UserController']);

        // With --file option
        process.argv = ['node', 'ostro', 'assistant', '--file', './bin/assistant', 'db:seed'];
        expect(cmd.getForwardedArgs()).toEqual(['db:seed']);

        // With --file=path option
        process.argv = ['node', 'ostro', 'assistant', '--file=./bin/assistant', 'key:generate'];
        expect(cmd.getForwardedArgs()).toEqual(['key:generate']);

        // When assistant is not present in process.argv
        process.argv = ['node', 'ostro', 'other'];
        expect(cmd.getForwardedArgs()).toEqual([]);
    });

    test('executeAssistant calls spawnSync with stdio inherit', () => {
        const cmd = new AssistantCommand();
        const spawnSpy = jest.spyOn(child_process, 'spawnSync').mockReturnValue({
            status: 0,
            stdout: Buffer.from(''),
            stderr: Buffer.from(''),
            output: [],
            pid: 1234,
            signal: null
        });

        const code = cmd.executeAssistant('/path/to/assistant', ['route:list'], '/project');
        expect(code).toBe(0);
        expect(spawnSpy).toHaveBeenCalledWith(process.execPath, ['/path/to/assistant', 'route:list'], {
            cwd: '/project',
            stdio: 'inherit'
        });

        // Error fallback
        spawnSpy.mockReturnValue({
            status: null,
            error: new Error('Execution failed'),
            stdout: Buffer.from(''),
            stderr: Buffer.from(''),
            output: [],
            pid: 1234,
            signal: null
        });
        const errCode = cmd.executeAssistant('/path/to/assistant', []);
        expect(errCode).toBe(1);

        // Fallback when status is null and error is undefined
        spawnSpy.mockReturnValue({
            status: null,
            error: undefined,
            stdout: Buffer.from(''),
            stderr: Buffer.from(''),
            output: [],
            pid: 1234,
            signal: null
        });
        expect(cmd.executeAssistant('/path/to/assistant', [])).toBe(0);
    });

    test('handle fails and exits 1 when assistant file does not exist', async () => {
        const cmd = new AssistantCommand();
        cmd.input = {
            getOption: jest.fn().mockReturnValue(undefined),
            getArgument: jest.fn().mockReturnValue(undefined)
        };
        cmd.error = jest.fn();

        jest.spyOn(fs, 'existsSync').mockReturnValue(false);

        await cmd.handle();

        expect(cmd.error).toHaveBeenCalledWith(expect.stringContaining('Assistant file not found'));
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('handle executes assistant and propagates exit code', async () => {
        const cmd = new AssistantCommand();
        cmd.input = {
            getOption: jest.fn().mockReturnValue('./custom/assistant'),
            getArgument: jest.fn().mockReturnValue(undefined)
        };
        cmd.error = jest.fn();

        jest.spyOn(fs, 'existsSync').mockReturnValue(true);
        const execSpy = jest.spyOn(cmd, 'executeAssistant').mockReturnValue(0);

        // Simulated commander command on this
        (cmd as any).commanderCommand = { args: ['migrate', '--force'] };

        await cmd.handle();

        expect(execSpy).toHaveBeenCalledWith(
            path.resolve(process.cwd(), './custom/assistant'),
            ['migrate', '--force'],
            process.cwd()
        );
        expect(process.exit).not.toHaveBeenCalled();

        // Non-zero exit code
        execSpy.mockReturnValue(42);
        await cmd.handle();
        expect(process.exit).toHaveBeenCalledWith(42);
    });
});
