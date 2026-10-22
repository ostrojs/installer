import child_process from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import readline from 'readline';
import { EventEmitter } from 'events';

import NewCommand from '../src/newCommand';

describe('NewCommand', () => {
    let originalExit: typeof process.exit;
    let originalStdoutWrite: typeof process.stdout.write;
    let originalIsTTY: boolean | undefined;
    let originalColumns: number | undefined;

    beforeEach(() => {
        originalExit = process.exit;
        process.exit = jest.fn() as unknown as typeof process.exit;
        originalStdoutWrite = process.stdout.write;
        process.stdout.write = jest.fn() as unknown as typeof process.stdout.write;
        originalIsTTY = process.stdout.isTTY;
        originalColumns = process.stdout.columns;
    });

    afterEach(() => {
        process.exit = originalExit;
        process.stdout.write = originalStdoutWrite;
        process.stdout.isTTY = originalIsTTY;
        process.stdout.columns = originalColumns;
        jest.restoreAllMocks();
    });

    test('command signature, description, options, and arguments', () => {
        const cmd: NewCommand = new NewCommand();
        expect(cmd.$signature).toBe('new');
        expect(cmd.$description).toBe('Create a new OstroJS application');
        expect(cmd.$options.length).toBe(3);
        expect(cmd.$arguments.length).toBe(2);
    });

    test('replaceInFile replaces matching text in file', () => {
        const cmd: NewCommand = new NewCommand();
        const tmpFile: string = path.join(os.tmpdir(), `test-file-${Date.now()}.txt`);
        fs.writeFileSync(tmpFile, 'Hello World');
        try {
            cmd.replaceInFile('World', 'Ostro', tmpFile);
            expect(fs.readFileSync(tmpFile, 'utf8')).toBe('Hello Ostro');
        } finally {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
        }
    });

    test('verifyApplicationDoesntExist passes when path does not exist', () => {
        const cmd: NewCommand = new NewCommand();
        const nonExistent: string = path.join(os.tmpdir(), `non-existent-${Date.now()}`);
        expect(() => cmd.verifyApplicationDoesntExist(nonExistent)).not.toThrow();
        expect(process.exit).not.toHaveBeenCalled();
    });

    test('verifyApplicationDoesntExist ignores current working directory', () => {
        const cmd: NewCommand = new NewCommand();
        expect(() => cmd.verifyApplicationDoesntExist(process.cwd())).not.toThrow();
        expect(process.exit).not.toHaveBeenCalled();
    });

    test('verifyApplicationDoesntExist exits when directory or file exists', () => {
        const cmd: NewCommand = new NewCommand();
        cmd.output = { writeln: jest.fn(), write: jest.fn() };
        cmd.error = jest.fn();

        const tmpDir: string = path.join(os.tmpdir(), `exists-${Date.now()}`);
        fs.mkdirSync(tmpDir);
        try {
            cmd.verifyApplicationDoesntExist(tmpDir);
            expect(cmd.error).toHaveBeenCalledWith('Application already exists!');
            expect(process.exit).toHaveBeenCalledWith(1);
        } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('runCommandsSync executes shell command synchronously', () => {
        const cmd: NewCommand = new NewCommand();
        const out: string = cmd.runCommandsSync(['node -e "console.log(\'hello-sync\')"']);
        expect(out.trim()).toBe('hello-sync');
    });

    test('runCommandsAsync resolves on success and rejects on error', async () => {
        const cmd: NewCommand = new NewCommand();
        const out: string = await cmd.runCommandsAsync(['node -e "console.log(\'hello-async\')"']);
        expect(out.trim()).toBe('hello-async');

        await expect(cmd.runCommandsAsync(['node -e "process.exit(1)"'])).rejects.toThrow();
    });

    test('updateSingleLine and clearLine handle TTY and truncation', () => {
        const cmd: NewCommand = new NewCommand();
        process.stdout.isTTY = true;
        process.stdout.columns = 30;

        jest.spyOn(readline, 'clearLine').mockImplementation(() => true);
        jest.spyOn(readline, 'cursorTo').mockImplementation(() => true);

        // Short message
        cmd.updateSingleLine('[1/7]', 'short text');
        expect(process.stdout.write).toHaveBeenCalledWith('[1/7] short text');

        // Long message requiring truncation (columns = 30, max length = 28)
        cmd.updateSingleLine('[1/7]', 'a very long message that definitely exceeds 30 columns limit');
        expect(process.stdout.write).toHaveBeenCalledWith(expect.stringContaining('...'));

        // Non-TTY does not write
        process.stdout.isTTY = false;
        (process.stdout.write as unknown as jest.Mock).mockClear();
        cmd.updateSingleLine('[1/7]', 'ignored');
        expect(process.stdout.write).not.toHaveBeenCalled();

        // clearLine
        process.stdout.isTTY = true;
        cmd.clearLine();
        expect(readline.clearLine).toHaveBeenCalledWith(process.stdout, 0);

        process.stdout.isTTY = false;
        (readline.clearLine as unknown as jest.Mock).mockClear();
        cmd.clearLine();
        expect(readline.clearLine).not.toHaveBeenCalled();
    });

    test('spinner start, interval tick, and stop', () => {
        jest.useFakeTimers();
        const cmd: NewCommand = new NewCommand();
        const updateSpy = jest.spyOn(cmd, 'updateSingleLine').mockImplementation(() => {});
        const clearSpy = jest.spyOn(cmd, 'clearLine').mockImplementation(() => {});

        cmd.startSpinner('[3/7]', 'Crafting');
        expect(cmd.spinnerTimer).toBeDefined();

        // Advance timers to trigger interval
        jest.advanceTimersByTime(160);
        expect(updateSpy).toHaveBeenCalled();

        cmd.stopSpinnerAndClear();
        expect(cmd.spinnerTimer).toBeNull();
        expect(clearSpy).toHaveBeenCalled();

        // Calling stopSpinner again is a no-op
        expect(() => cmd.stopSpinner()).not.toThrow();
        jest.useRealTimers();
    });

    test('runNpmInstallWithRealtimeLog success, error, and close failure', async () => {
        jest.useFakeTimers();
        const cmd: NewCommand = new NewCommand();
        jest.spyOn(cmd, 'updateSingleLine').mockImplementation(() => {});

        // 1. Success case
        const mockChildSuccess = new EventEmitter() as any;
        mockChildSuccess.stdout = new EventEmitter();
        mockChildSuccess.stderr = new EventEmitter();

        jest.spyOn(child_process, 'exec').mockReturnValue(mockChildSuccess);

        const promiseSuccess = cmd.runNpmInstallWithRealtimeLog('/dummy/dir', '[5/7]');

        // Emit stdout data
        mockChildSuccess.stdout.emit('data', 'added 10 packages\n');
        // Advance timer to trigger spinner tick
        jest.advanceTimersByTime(100);
        expect(cmd.updateSingleLine).toHaveBeenCalledWith('[5/7]', expect.stringContaining('added 10 packages'));

        // Emit stderr data
        mockChildSuccess.stderr.emit('data', 'warn some deprecated package\n');
        jest.advanceTimersByTime(100);

        // Close successfully
        mockChildSuccess.emit('close', 0);
        await expect(promiseSuccess).resolves.toBeUndefined();

        // 2. Failure on close with non-zero code
        const mockChildFail = new EventEmitter() as any;
        mockChildFail.stdout = new EventEmitter();
        mockChildFail.stderr = new EventEmitter();
        (child_process.exec as unknown as jest.Mock).mockReturnValue(mockChildFail);

        const promiseFail = cmd.runNpmInstallWithRealtimeLog('/dummy/dir', '[5/7]');
        mockChildFail.emit('close', 1);
        await expect(promiseFail).rejects.toThrow('npm install failed with exit code 1');

        // 3. Child error event
        const mockChildErr = new EventEmitter() as any;
        mockChildErr.stdout = new EventEmitter();
        mockChildErr.stderr = new EventEmitter();
        (child_process.exec as unknown as jest.Mock).mockReturnValue(mockChildErr);

        const promiseErr = cmd.runNpmInstallWithRealtimeLog('/dummy/dir', '[5/7]');
        mockChildErr.emit('error', new Error('spawn failure'));
        await expect(promiseErr).rejects.toThrow('spawn failure');

        jest.useRealTimers();
    });

    describe('handle() execution flow', () => {
        test('throws error when --force used with current directory .', async () => {
            const cmd: NewCommand = new NewCommand();
            cmd.output = { writeln: jest.fn(), write: jest.fn() };
            cmd.error = jest.fn();
            cmd.info = jest.fn();
            cmd.input = {
                getArgument: jest.fn().mockReturnValue('.'),
                getOption: jest.fn().mockImplementation((opt: string) => opt === 'force')
            };

            await cmd.handle();
            expect(cmd.error).toHaveBeenCalledWith(
                expect.stringContaining('Cannot use --force option when using current directory for installation!')
            );
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('successful install workflow on POSIX system', async () => {
            const cmd: NewCommand = new NewCommand();
            const written: string[] = [];
            cmd.output = {
                writeln: jest.fn((msg: string) => written.push(msg)),
                write: jest.fn((msg: string) => written.push(msg))
            };
            cmd.error = jest.fn();
            cmd.info = jest.fn();
            cmd.input = {
                getArgument: jest.fn().mockReturnValue('my-app'),
                getOption: jest.fn().mockReturnValue(false)
            };

            jest.spyOn(os, 'type').mockReturnValue('Linux');
            jest.spyOn(cmd, 'verifyApplicationDoesntExist').mockImplementation(() => {});
            jest.spyOn(cmd, 'runCommandsSync').mockImplementation((cmds: string[]): string => {
                const cmdStr: string = cmds[0];
                if (cmdStr.includes('npm show @ostro/installer version')) return '1.0.6';
                if (cmdStr.includes('npm ls @ostro/installer -g version')) return '@ostro/installer@1.0.6';
                if (cmdStr.includes('npm v @ostro/ostro dist.tarball')) return 'https://registry.npmjs.org/@ostro/ostro/-/ostro-1.0.0.tgz';
                return '';
            });
            jest.spyOn(cmd, 'runCommandsAsync').mockImplementation(async (cmds: string[], options?: { cwd?: string }) => {
                if (options && options.cwd) {
                    fs.writeFileSync(path.join(options.cwd, '.env.example'), 'APP_URL=http://localhost\nDB_DATABASE=ostro\n');
                }
                return 'ok';
            });
            jest.spyOn(cmd, 'runNpmInstallWithRealtimeLog').mockResolvedValue(undefined);
            jest.spyOn(cmd, 'replaceInFile').mockImplementation(() => {});
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
            jest.spyOn(fs, 'cpSync').mockImplementation(() => {});

            await cmd.handle();

            expect(cmd.info).toHaveBeenCalledWith('@ostro/installer version verified');
            expect(cmd.info).toHaveBeenCalledWith('Application crafted');
            expect(cmd.info).toHaveBeenCalledWith('Environment file generated');
            expect(cmd.info).toHaveBeenCalledWith('Dependencies installed');
            expect(cmd.info).toHaveBeenCalledWith('Key generated');
            expect(cmd.info).toHaveBeenCalledWith('TypeScript framework built');
            expect(cmd.info).toHaveBeenCalledWith('Application ready at destination (TS)');
            expect(process.exit).not.toHaveBeenCalled();
        });

        test('successful install workflow on Windows_NT with outdated version and --force', async () => {
            const cmd: NewCommand = new NewCommand();
            cmd.output = {
                writeln: jest.fn(),
                write: jest.fn()
            };
            cmd.error = jest.fn();
            cmd.info = jest.fn();
            cmd.input = {
                getArgument: jest.fn().mockReturnValue('custom_proj'),
                getOption: jest.fn().mockImplementation((opt: string) => opt === 'force')
            };

            jest.spyOn(os, 'type').mockReturnValue('Windows_NT');
            jest.spyOn(cmd, 'runCommandsSync').mockImplementation((cmds: string[]): string => {
                const cmdStr: string = cmds[0];
                if (cmdStr.includes('npm show @ostro/installer version')) return '2.0.0';
                if (cmdStr.includes('npm ls @ostro/installer -g version')) return '@ostro/installer@1.0.6';
                if (cmdStr.includes('npm v @ostro/ostro dist.tarball')) return 'https://registry.npmjs.org/@ostro/ostro/-/ostro-1.0.0.tgz';
                return '';
            });
            jest.spyOn(cmd, 'runCommandsAsync').mockResolvedValue('ok');
            jest.spyOn(cmd, 'runNpmInstallWithRealtimeLog').mockResolvedValue(undefined);
            jest.spyOn(cmd, 'replaceInFile').mockImplementation(() => {});
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
            jest.spyOn(fs, 'rmSync').mockImplementation(() => {});
            jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
            jest.spyOn(fs, 'cpSync').mockImplementation(() => {});

            await cmd.handle();

            // Outdated version triggers error notice
            expect(cmd.error).toHaveBeenCalledWith('Update required: "npm install @ostro/installer@latest -g"');
            expect(fs.rmSync).toHaveBeenCalled();
            expect(cmd.info).toHaveBeenCalledWith('Application ready at destination (TS)');
        });

        test('handles force remove error gracefully during directory creation', async () => {
            const cmd: NewCommand = new NewCommand();
            cmd.output = {
                writeln: jest.fn(),
                write: jest.fn()
            };
            cmd.error = jest.fn();
            cmd.info = jest.fn();
            cmd.input = {
                getArgument: jest.fn().mockReturnValue('my-app'),
                getOption: jest.fn().mockImplementation((opt: string) => opt === 'force')
            };

            jest.spyOn(cmd, 'runCommandsSync').mockImplementation((cmds: string[]): string => {
                const cmdStr: string = cmds[0];
                if (cmdStr.includes('npm show @ostro/installer version')) return '1.0.0';
                if (cmdStr.includes('npm ls @ostro/installer -g version')) return '@ostro/installer@1.0.0';
                if (cmdStr.includes('npm v @ostro/ostro dist.tarball')) return 'https://registry.npmjs.org/tarball.tgz';
                return '';
            });
            jest.spyOn(cmd, 'runCommandsAsync').mockResolvedValue('ok');
            jest.spyOn(cmd, 'runNpmInstallWithRealtimeLog').mockResolvedValue(undefined);
            jest.spyOn(cmd, 'replaceInFile').mockImplementation(() => {});
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
            jest.spyOn(fs, 'cpSync').mockImplementation(() => {});
            jest.spyOn(fs, 'rmSync').mockImplementation(() => {
                throw new Error('EPERM error');
            });
            jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});

            await cmd.handle();

            expect(cmd.error).toHaveBeenCalledWith(expect.objectContaining({ message: 'EPERM error' }));
        });

        test('auto-removes created directory when subsequent step fails', async () => {
            const cmd: NewCommand = new NewCommand();
            cmd.output = {
                writeln: jest.fn(),
                write: jest.fn()
            };
            cmd.error = jest.fn();
            cmd.info = jest.fn();
            cmd.input = {
                getArgument: jest.fn().mockReturnValue('failing-app'),
                getOption: jest.fn().mockReturnValue(false)
            };

            jest.spyOn(cmd, 'verifyApplicationDoesntExist').mockImplementation(() => {});
            jest.spyOn(cmd, 'runCommandsSync').mockImplementation((cmds: string[]): string => {
                const cmdStr: string = cmds[0];
                if (cmdStr.includes('npm show @ostro/installer version')) return '1.0.0';
                if (cmdStr.includes('npm ls @ostro/installer -g version')) return '@ostro/installer@1.0.0';
                if (cmdStr.includes('npm v @ostro/ostro dist.tarball')) return 'https://registry.npmjs.org/tarball.tgz';
                return '';
            });
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
            const rmSyncSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});
            // Fail during runCommandsAsync (crafting step)
            jest.spyOn(cmd, 'runCommandsAsync').mockRejectedValue(new Error('Crafting failed'));

            await cmd.handle();

            expect(cmd.error).toHaveBeenCalledWith(expect.stringContaining('Installation failed: Crafting failed'));
            expect(rmSyncSpy).toHaveBeenCalled();
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('auto-removes destination directory when copy to destination fails', async () => {
            const cmd: NewCommand = new NewCommand();
            cmd.output = { writeln: jest.fn(), write: jest.fn() };
            cmd.error = jest.fn();
            cmd.info = jest.fn();
            cmd.input = {
                getArgument: jest.fn().mockReturnValue('failing-app'),
                getOption: jest.fn().mockReturnValue(false)
            };

            jest.spyOn(cmd, 'verifyApplicationDoesntExist').mockImplementation(() => {});
            jest.spyOn(cmd, 'runCommandsSync').mockReturnValue('1.0.0');
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
            jest.spyOn(cmd, 'runCommandsAsync').mockResolvedValue('ok');
            jest.spyOn(cmd, 'runNpmInstallWithRealtimeLog').mockResolvedValue(undefined);
            jest.spyOn(cmd, 'replaceInFile').mockImplementation(() => {});
            jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
            jest.spyOn(fs, 'cpSync').mockImplementation(() => {
                throw new Error('Copy failed');
            });
            const rmSyncSpy = jest.spyOn(fs, 'rmSync').mockImplementation(() => {});

            await cmd.handle();

            expect(cmd.error).toHaveBeenCalledWith(expect.stringContaining('Installation failed: Copy failed'));
            expect(rmSyncSpy).toHaveBeenCalled();
            expect(cmd.info).toHaveBeenCalledWith(expect.stringContaining('Auto-removed failed directory'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('fails when auto-remove directory itself throws error', async () => {
            const cmd: NewCommand = new NewCommand();
            cmd.output = { writeln: jest.fn(), write: jest.fn() };
            cmd.error = jest.fn();
            cmd.info = jest.fn();
            cmd.input = {
                getArgument: jest.fn().mockReturnValue('failing-app'),
                getOption: jest.fn().mockReturnValue(false)
            };

            jest.spyOn(cmd, 'verifyApplicationDoesntExist').mockImplementation(() => {});
            jest.spyOn(cmd, 'runCommandsSync').mockReturnValue('1.0.0');
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
            jest.spyOn(fs, 'rmSync').mockImplementation(() => {
                throw new Error('rmSync fail');
            });
            jest.spyOn(cmd, 'runCommandsAsync').mockRejectedValue(new Error('Step failed'));

            await cmd.handle();

            expect(cmd.error).toHaveBeenCalledWith(expect.stringContaining('Installation failed: Step failed'));
            expect(process.exit).toHaveBeenCalledWith(1);
        });

        test('successful install workflow in current directory "." (skips db rename)', async () => {
            const cmd: NewCommand = new NewCommand();
            cmd.output = { writeln: jest.fn(), write: jest.fn() };
            cmd.error = jest.fn();
            cmd.info = jest.fn();
            cmd.input = {
                getArgument: jest.fn().mockReturnValue('.'),
                getOption: jest.fn().mockReturnValue(false)
            };

            jest.spyOn(os, 'type').mockReturnValue('Linux');
            jest.spyOn(cmd, 'verifyApplicationDoesntExist').mockImplementation(() => {});
            // Test falsy fallback for runCommandsSync
            jest.spyOn(cmd, 'runCommandsSync').mockImplementation((cmds: string[]): any => {
                const cmdStr: string = cmds[0];
                if (cmdStr.includes('npm show @ostro/installer version')) return null; // falsy fallback -> ''
                if (cmdStr.includes('npm ls @ostro/installer -g version')) return null; // falsy fallback -> ''
                if (cmdStr.includes('npm v @ostro/ostro dist.tarball')) return 'https://tarball.tgz';
                return '';
            });
            jest.spyOn(cmd, 'runCommandsAsync').mockResolvedValue('ok');
            jest.spyOn(cmd, 'runNpmInstallWithRealtimeLog').mockResolvedValue(undefined);
            jest.spyOn(cmd, 'replaceInFile').mockImplementation(() => {});
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
            jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});

            await cmd.handle();

            expect(cmd.replaceInFile).not.toHaveBeenCalled();
            expect(cmd.info).toHaveBeenCalledWith('Application ready at destination (TS)');
        });

        test('successful install workflow with format js', async () => {
            const cmd: NewCommand = new NewCommand();
            cmd.output = { writeln: jest.fn(), write: jest.fn() };
            cmd.error = jest.fn();
            cmd.info = jest.fn();
            cmd.input = {
                getArgument: jest.fn().mockReturnValue('js-app'),
                getOption: jest.fn().mockImplementation((opt: string) => opt === 'format' ? 'js' : false)
            };

            jest.spyOn(os, 'type').mockReturnValue('Linux');
            jest.spyOn(cmd, 'verifyApplicationDoesntExist').mockImplementation(() => {});
            jest.spyOn(cmd, 'runCommandsSync').mockImplementation((cmds: string[]): any => {
                const cmdStr: string = cmds[0];
                if (cmdStr.includes('npm show @ostro/installer version')) return '1.0.6';
                if (cmdStr.includes('npm ls @ostro/installer -g version')) return '@ostro/installer@1.0.6';
                if (cmdStr.includes('npm v @ostro/ostro dist.tarball')) return 'https://tarball.tgz';
                return '';
            });
            jest.spyOn(cmd, 'runCommandsAsync').mockResolvedValue('ok');
            jest.spyOn(cmd, 'runNpmInstallWithRealtimeLog').mockResolvedValue(undefined);
            jest.spyOn(cmd, 'replaceInFile').mockImplementation(() => {});
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
            jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
            jest.spyOn(fs, 'cpSync').mockImplementation(() => {});
            jest.spyOn(cmd, 'convertToJavaScript').mockResolvedValue(undefined);

            await cmd.handle();

            expect(cmd.info).toHaveBeenCalledWith('Pure JavaScript framework built');
            expect(cmd.info).toHaveBeenCalledWith('Application ready at destination (JS)');
            expect(cmd.output.writeln).toHaveBeenCalledWith('<fg=cyan>npm run server:start</fg>');
        });

        test('successful install workflow with format passed as argument', async () => {
            const cmd: NewCommand = new NewCommand();
            cmd.output = { write: jest.fn(), writeln: jest.fn() };
            cmd.info = jest.fn();
            cmd.error = jest.fn();
            cmd.input = {
                getArgument: jest.fn().mockImplementation((arg: string) => arg === 'name' ? 'js-app' : (arg === 'format' ? 'js' : '')),
                getOption: jest.fn().mockReturnValue(false)
            };

            jest.spyOn(os, 'type').mockReturnValue('Linux');
            jest.spyOn(cmd, 'verifyApplicationDoesntExist').mockImplementation(() => {});
            jest.spyOn(cmd, 'runCommandsSync').mockImplementation((cmds: string[]): any => {
                const cmdStr: string = cmds[0];
                if (cmdStr.includes('npm show @ostro/installer version')) return '1.0.6';
                if (cmdStr.includes('npm ls @ostro/installer -g version')) return '@ostro/installer@1.0.6';
                if (cmdStr.includes('npm v @ostro/ostro dist.tarball')) return 'https://tarball.tgz';
                return '';
            });
            jest.spyOn(cmd, 'runCommandsAsync').mockResolvedValue('ok');
            jest.spyOn(cmd, 'runNpmInstallWithRealtimeLog').mockResolvedValue(undefined);
            jest.spyOn(cmd, 'replaceInFile').mockImplementation(() => {});
            jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);
            jest.spyOn(fs, 'copyFileSync').mockImplementation(() => {});
            jest.spyOn(fs, 'cpSync').mockImplementation(() => {});
            jest.spyOn(cmd, 'convertToJavaScript').mockResolvedValue(undefined);

            await cmd.handle();

            expect(cmd.info).toHaveBeenCalledWith('Pure JavaScript framework built');
            expect(cmd.info).toHaveBeenCalledWith('Application ready at destination (JS)');
            expect(cmd.output.writeln).toHaveBeenCalledWith('<fg=cyan>npm run server:start</fg>');
        });
    });

    test('updateSingleLine uses default 80 columns when process.stdout.columns is undefined', () => {
        const cmd: NewCommand = new NewCommand();
        process.stdout.isTTY = true;
        (process.stdout as { columns?: number }).columns = undefined;

        jest.spyOn(readline, 'clearLine').mockImplementation(() => true);
        jest.spyOn(readline, 'cursorTo').mockImplementation(() => true);

        cmd.updateSingleLine('[1/7]', 'normal length message');
        expect(process.stdout.write).toHaveBeenCalledWith('[1/7] normal length message');
    });

    test('runNpmInstallWithRealtimeLog ignores empty output lines', async () => {
        const cmd: NewCommand = new NewCommand();
        jest.spyOn(cmd, 'updateSingleLine').mockImplementation(() => {});

        const mockChild = new EventEmitter() as any;
        mockChild.stdout = new EventEmitter();
        mockChild.stderr = new EventEmitter();
        jest.spyOn(child_process, 'exec').mockReturnValue(mockChild);

        const promise = cmd.runNpmInstallWithRealtimeLog('/dummy/dir', '[5/7]');
        // Emit whitespace and empty lines only
        mockChild.stdout.emit('data', '   \n\n  \n');
        mockChild.emit('close', 0);

        await expect(promise).resolves.toBeUndefined();
    });

    test('verifyApplicationDoesntExist checks file existence as well', () => {
        const cmd: NewCommand = new NewCommand();
        cmd.output = { writeln: jest.fn(), write: jest.fn() };
        cmd.error = jest.fn();

        jest.spyOn(fs, 'statSync').mockReturnValue({
            isDirectory: (): boolean => false,
            isFile: (): boolean => true
        } as fs.Stats);

        cmd.verifyApplicationDoesntExist('/fake/file.txt');
        expect(cmd.error).toHaveBeenCalledWith('Application already exists!');
        expect(process.exit).toHaveBeenCalledWith(1);

        // Neither directory nor file (e.g. socket/fifo)
        (fs.statSync as unknown as jest.Mock).mockReturnValue({
            isDirectory: (): boolean => false,
            isFile: (): boolean => false
        } as fs.Stats);
        (process.exit as unknown as jest.Mock).mockClear();
        cmd.verifyApplicationDoesntExist('/fake/fifo');
        expect(process.exit).not.toHaveBeenCalled();
    });

    test('removeTypeScriptArtifacts deletes .ts, .d.ts, .d.ts.map, and tsconfig files recursively', () => {
        const cmd: NewCommand = new NewCommand();
        const tmpDir: string = path.join(os.tmpdir(), `test-ts-clean-${Date.now()}`);
        const subDir: string = path.join(tmpDir, 'sub');
        const nodeModules: string = path.join(tmpDir, 'node_modules');
        const gitDir: string = path.join(tmpDir, '.git');
        fs.mkdirSync(subDir, { recursive: true });
        fs.mkdirSync(nodeModules, { recursive: true });
        fs.mkdirSync(gitDir, { recursive: true });

        fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'export default {};');
        fs.writeFileSync(path.join(tmpDir, 'app.js'), 'module.exports = {};');
        fs.writeFileSync(path.join(tmpDir, 'app.d.ts'), 'export {};');
        fs.writeFileSync(path.join(tmpDir, 'app.d.ts.map'), '{}');
        fs.writeFileSync(path.join(tmpDir, 'tsconfig.json'), '{}');
        fs.writeFileSync(path.join(tmpDir, 'tsconfig.build.json'), '{}');
        fs.writeFileSync(path.join(subDir, 'child.ts'), 'export const a = 1;');
        fs.writeFileSync(path.join(nodeModules, 'keep.ts'), 'keep');
        fs.writeFileSync(path.join(gitDir, 'git.ts'), 'git');

        try {
            cmd.removeTypeScriptArtifacts(tmpDir);
            expect(fs.existsSync(path.join(tmpDir, 'app.js'))).toBe(true);
            expect(fs.existsSync(path.join(tmpDir, 'app.ts'))).toBe(false);
            expect(fs.existsSync(path.join(tmpDir, 'app.d.ts'))).toBe(false);
            expect(fs.existsSync(path.join(tmpDir, 'app.d.ts.map'))).toBe(false);
            expect(fs.existsSync(path.join(tmpDir, 'tsconfig.json'))).toBe(false);
            expect(fs.existsSync(path.join(tmpDir, 'tsconfig.build.json'))).toBe(false);
            expect(fs.existsSync(path.join(subDir, 'child.ts'))).toBe(false);
            expect(fs.existsSync(path.join(nodeModules, 'keep.ts'))).toBe(true);
            expect(fs.existsSync(path.join(gitDir, 'git.ts'))).toBe(true);
        } finally {
            if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('updatePackageJsonForJavaScript modifies package.json correctly', () => {
        const cmd: NewCommand = new NewCommand();
        const tmpDir: string = path.join(os.tmpdir(), `test-pkg-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        const pkgFile: string = path.join(tmpDir, 'package.json');
        fs.writeFileSync(pkgFile, JSON.stringify({
            main: 'app.ts',
            types: 'app.ts',
            scripts: {
                build: 'tsc',
                'build:clean': 'rm -rf build',
                start: 'node app.js',
                'start:prod': 'node build/app.js'
            },
            devDependencies: {
                typescript: '^5.0.0',
                '@types/node': '^20.0.0',
                'ts-node': '^10.9.0',
                tsx: '^4.0.0',
                other: '1.0.0'
            }
        }, null, 2));

        try {
            cmd.updatePackageJsonForJavaScript(tmpDir);
            const updated = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
            expect(updated.main).toBe('app.js');
            expect(updated.types).toBeUndefined();
            expect(updated.scripts.build).toBeUndefined();
            expect(updated.scripts['build:clean']).toBeUndefined();
            expect(updated.scripts['start:prod']).toBeUndefined();
            expect(updated.scripts.start).toBeUndefined();
            expect(updated.scripts.server).toBeUndefined();
            expect(updated.scripts['server:start']).toBe('node app.js');
            expect(updated.devDependencies.typescript).toBeUndefined();
            expect(updated.devDependencies['@types/node']).toBeUndefined();
            expect(updated.devDependencies['ts-node']).toBeUndefined();
            expect(updated.devDependencies.tsx).toBeUndefined();
            expect(updated.devDependencies.other).toBe('1.0.0');

            // Non-existent package.json should not throw
            expect(() => cmd.updatePackageJsonForJavaScript('/non/existent')).not.toThrow();
        } finally {
            if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('convertToJavaScript runs build, removes TS artifacts and updates package.json', async () => {
        const cmd: NewCommand = new NewCommand();
        const tmpDir: string = path.join(os.tmpdir(), `test-convert-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(path.join(tmpDir, 'app.js'), 'console.log("hello");');
        fs.writeFileSync(path.join(tmpDir, 'app.ts'), 'console.log("hello");');
        fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ main: 'app.ts' }));

        jest.spyOn(cmd, 'buildWithTsc').mockResolvedValue();

        try {
            await cmd.convertToJavaScript(tmpDir);
            expect(cmd.buildWithTsc).toHaveBeenCalledWith(tmpDir);
            expect(fs.existsSync(path.join(tmpDir, 'app.js'))).toBe(true);
            expect(fs.existsSync(path.join(tmpDir, 'app.ts'))).toBe(false);
        } finally {
            if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('getTscCommand and buildWithTsc with tsconfig.build.json or fallback', async () => {
        const cmd: NewCommand = new NewCommand();
        const tscCmd = cmd.getTscCommand();
        expect(tscCmd).toContain('tsc');

        const tmpDir: string = path.join(os.tmpdir(), `test-tsc-build-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        const runAsyncSpy = jest.spyOn(cmd, 'runCommandsAsync').mockResolvedValue('tsc ok');

        try {
            // Fallback when tsconfig.build.json doesn't exist
            await cmd.buildWithTsc(tmpDir);
            expect(runAsyncSpy).toHaveBeenCalledWith([`${tscCmd} -p tsconfig.json`], { cwd: tmpDir });

            // When tsconfig.build.json exists
            fs.writeFileSync(path.join(tmpDir, 'tsconfig.build.json'), '{}');
            await cmd.buildWithTsc(tmpDir);
            expect(runAsyncSpy).toHaveBeenCalledWith([`${tscCmd} -p tsconfig.build.json`], { cwd: tmpDir });
        } finally {
            if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('cleanCompiledFile strips strict, esModule, sourcemap, and cleans indexed identifiers', () => {
        const cmd: NewCommand = new NewCommand();
        const input: string = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const application_1 = require("@ostro/foundation/application");
const kernel_1 = require("~/app/http/kernel");
const kernel_2 = require("~/app/console/kernel");
const function_1 = require("@ostro/support/function");
const app = new application_1.default(process.cwd());
app.singleton('@ostro/contracts/http/kernel', kernel_1.default);
app.singleton('@ostro/contracts/console/kernel', kernel_2.default);
const port = (0, function_1.env)('PORT', 8080);
const otherCall = (0, obj.custom)();
exports.default = app;
//# sourceMappingURL=app.js.map
`;
        const result: string = cmd.cleanCompiledFile(input);
        expect(result).not.toContain('"use strict"');
        expect(result).not.toContain('Object.defineProperty(exports, "__esModule"');
        expect(result).not.toContain('//# sourceMappingURL');
        expect(result).not.toContain('_interop');
        expect(result).not.toContain('.default');
        expect(result).toContain('const application = require("@ostro/foundation/application");');
        expect(result).toContain('const kernel = require("~/app/http/kernel");');
        expect(result).toContain('const kernel2 = require("~/app/console/kernel");');
        expect(result).toContain('const { env } = require("@ostro/support/function");');
        expect(result).toContain('const port = env(\'PORT\', 8080);');
        expect(result).toContain('const otherCall = obj.custom();');
        expect(result).toContain('const app = new application(process.cwd());');
        expect(result).toContain("app.singleton('@ostro/contracts/http/kernel', kernel);");
        expect(result).toContain("app.singleton('@ostro/contracts/console/kernel', kernel2);");
        expect(result).toContain('module.exports = app;');
        expect(result).not.toContain('module.exports.default');
    });

    test('cleanJavaScriptArtifacts deletes map files and cleans js files recursively', () => {
        const cmd: NewCommand = new NewCommand();
        const tmpDir: string = path.join(os.tmpdir(), `test-clean-artifacts-${Date.now()}`);
        const subDir: string = path.join(tmpDir, 'sub');
        fs.mkdirSync(subDir, { recursive: true });

        const mapFile: string = path.join(subDir, 'test.js.map');
        const jsFile: string = path.join(subDir, 'test.js');
        fs.writeFileSync(mapFile, '{"version":3}');
        fs.writeFileSync(jsFile, '"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports.default = 42;\n//# sourceMappingURL=test.js.map\n');

        try {
            cmd.cleanJavaScriptArtifacts(tmpDir);
            expect(fs.existsSync(mapFile)).toBe(false);
            expect(fs.existsSync(jsFile)).toBe(true);
            const content = fs.readFileSync(jsFile, 'utf8');
            expect(content).not.toContain('"use strict"');
            expect(content).not.toContain('sourceMappingURL');
            expect(content).toContain('module.exports = 42;');
            expect(content).not.toContain('module.exports.default');
        } finally {
            if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('cleanJavaScriptArtifacts leaves unchanged js files as-is', () => {
        const cmd: NewCommand = new NewCommand();
        const tmpDir: string = path.join(os.tmpdir(), `test-clean-nochange-${Date.now()}`);
        fs.mkdirSync(tmpDir, { recursive: true });
        const jsFile: string = path.join(tmpDir, 'plain.js');
        fs.writeFileSync(jsFile, 'console.log("clean");\n');
        try {
            cmd.cleanJavaScriptArtifacts(tmpDir);
            expect(fs.readFileSync(jsFile, 'utf8')).toBe('console.log("clean");\n');
        } finally {
            if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    test('fixBinSymlinks updates symlinks targeting tempWorkingDir', () => {
        const cmd: NewCommand = new NewCommand();
        const tmpDir: string = path.join(os.tmpdir(), `test-fix-bin-${Date.now()}`);
        const tempWorkingDir: string = path.join(os.tmpdir(), `test-temp-worker-${Date.now()}`);
        const binDir: string = path.join(tmpDir, 'node_modules', '.bin');
        fs.mkdirSync(binDir, { recursive: true });

        // Create target in destination and dummy symlinks
        const targetFile: string = path.join(tmpDir, 'node_modules', 'ts-node', 'bin.js');
        fs.mkdirSync(path.dirname(targetFile), { recursive: true });
        fs.writeFileSync(targetFile, '#!/usr/bin/env node');

        const symlinkPath: string = path.join(binDir, 'ts-node');
        const oldTarget: string = path.join(tempWorkingDir, 'node_modules', 'ts-node', 'bin.js');
        fs.symlinkSync(oldTarget, symlinkPath);

        const regularFile: string = path.join(binDir, 'regular.txt');
        fs.writeFileSync(regularFile, 'regular file');

        const unrelatedSymlink: string = path.join(binDir, 'other-link');
        fs.symlinkSync('/usr/local/bin/dummy', unrelatedSymlink);

        try {
            cmd.fixBinSymlinks(tmpDir, tempWorkingDir);
            expect(fs.readlinkSync(symlinkPath)).toBe(targetFile);
            expect(fs.readlinkSync(unrelatedSymlink)).toBe('/usr/local/bin/dummy');
        } finally {
            if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

});



