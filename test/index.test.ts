import { describe, test, expect, beforeEach, afterEach, jest } from "@jest/globals";
describe('CLI Index Entry Point', () => {
    let originalArgv: string[];
    let originalExit: typeof process.exit;
    let originalError: typeof console.error;

    beforeEach(() => {
        originalArgv = process.argv;
        originalExit = process.exit;
        originalError = console.error;
        process.exit = jest.fn() as unknown as typeof process.exit;
        console.error = jest.fn();
        jest.resetModules();
    });

    afterEach(() => {
        process.argv = originalArgv;
        process.exit = originalExit;
        console.error = originalError;
        jest.restoreAllMocks();
    });

    test('runs successfully and calls process.exit(0)', async () => {
        process.argv = ['node', 'index.js', '--help'];
        
        // Mock ConsoleApplication run method
        const _ConsoleApp = require('@ostro/console');
        const ConsoleApplication = _ConsoleApp.default || _ConsoleApp;
        const runSpy = jest.spyOn(ConsoleApplication.prototype, 'run').mockResolvedValue(0);

        require('../src/index');

        // Allow promise microtask to resolve
        await new Promise(process.nextTick);

        expect(runSpy).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(0);
    });

    test('handles error and calls process.exit(1)', async () => {
        process.argv = ['node', 'index.js', 'invalid'];

        const _ConsoleApp = require('@ostro/console');
        const ConsoleApplication = _ConsoleApp.default || _ConsoleApp;
        const testErr: Error = new Error('CLI execution failure');
        const runSpy = jest.spyOn(ConsoleApplication.prototype, 'run').mockRejectedValue(testErr);

        require('../src/index');

        // Allow promise microtask to resolve
        await new Promise(process.nextTick);

        expect(runSpy).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(testErr);
        expect(process.exit).toHaveBeenCalledWith(1);
    });

    test('handles case when commander command is not present in program.commands', async () => {
        process.argv = ['node', 'index.js', '--help'];
        const commander = require('commander');
        jest.spyOn(commander.program.commands, 'find').mockReturnValue(undefined);

        const _ConsoleApp = require('@ostro/console');
        const ConsoleApplication = _ConsoleApp.default || _ConsoleApp;
        jest.spyOn(ConsoleApplication.prototype, 'run').mockResolvedValue(0);

        require('../src/index');
        await new Promise(process.nextTick);

        expect(process.exit).toHaveBeenCalledWith(0);
    });
});
