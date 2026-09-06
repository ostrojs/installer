const EventEmitter = require('events');

describe('CLI Index Entry Point', () => {
    let originalArgv;
    let originalExit;
    let originalError;

    beforeEach(() => {
        originalArgv = process.argv;
        originalExit = process.exit;
        originalError = console.error;
        process.exit = jest.fn();
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
        const ConsoleApplication = require('@ostro/console');
        const runSpy = jest.spyOn(ConsoleApplication.prototype, 'run').mockResolvedValue(0);

        require('../index.js');

        // Allow promise microtask to resolve
        await new Promise(process.nextTick);

        expect(runSpy).toHaveBeenCalled();
        expect(process.exit).toHaveBeenCalledWith(0);
    });

    test('handles error and calls process.exit(1)', async () => {
        process.argv = ['node', 'index.js', 'invalid'];

        const ConsoleApplication = require('@ostro/console');
        const testErr = new Error('CLI execution failure');
        const runSpy = jest.spyOn(ConsoleApplication.prototype, 'run').mockRejectedValue(testErr);

        require('../index.js');

        // Allow promise microtask to resolve
        await new Promise(process.nextTick);

        expect(runSpy).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith(testErr);
        expect(process.exit).toHaveBeenCalledWith(1);
    });
});
