import Command from '@ostro/console/command';
import type { ExecOptions, ExecSyncOptions } from 'node:child_process';
interface NewCommand {
    input: {
        getArgument(name: string): any;
        getOption(name: string): any;
    };
    output: {
        write(message: string): void;
        writeln(message: string): void;
    };
    info(message: string): void;
    error(message: unknown): void;
}
/**
 * Command class for initializing a new OstroJS application across Linux, macOS, and Windows.
 */
declare class NewCommand extends Command {
    /**
     * The console command signature.
     */
    get $signature(): string;
    /**
     * The console command description.
     */
    get $description(): string;
    /**
     * The console command options definition.
     */
    get $options(): any[];
    /**
     * The console command arguments definition.
     */
    get $arguments(): any[];
    /**
     * Active spinner timer instance.
     */
    spinnerTimer: NodeJS.Timeout | null;
    /**
     * Execute the console command.
     *
     * @returns A promise that resolves when installation completes.
     */
    handle(): Promise<void>;
    /**
     * Start an animated progress spinner for a given step.
     *
     * @param prefix - Step identifier (e.g. '[3/7]').
     * @param label - Progress label message.
     */
    startSpinner(prefix: string, label: string): void;
    /**
     * Stop the currently running progress spinner.
     */
    stopSpinner(): void;
    /**
     * Stop the active spinner and clear the current stdout terminal line.
     */
    stopSpinnerAndClear(): void;
    /**
     * Update the current terminal line with a single line message.
     *
     * @param prefix - Step label or prefix.
     * @param text - Message text to display.
     */
    updateSingleLine(prefix: string, text: string): void;
    /**
     * Clear the current line on TTY terminal output.
     */
    clearLine(): void;
    /**
     * Run `npm install` asynchronously while streaming real-time output on a single line.
     * Uses system shell context and an active spinner to ensure non-blocking execution across OSes.
     *
     * @param directory - Path to the target directory.
     * @param prefix - Step label prefix.
     * @returns A promise that resolves when installation completes.
     */
    runNpmInstallWithRealtimeLog(directory: string, prefix: string): Promise<void>;
    /**
     * Execute shell commands asynchronously and return a Promise.
     *
     * @param commands - List of commands to execute sequentially.
     * @param options - Additional options for child_process.exec (e.g. { cwd }).
     * @returns Output from executed commands.
     */
    runCommandsAsync(commands: string[], options?: ExecOptions): Promise<string>;
    /**
     * Execute shell commands synchronously.
     *
     * @param commands - List of commands to execute.
     * @param options - Additional options for child_process.execSync.
     * @returns Standard output from execution.
     */
    runCommandsSync(commands: string[], options?: ExecSyncOptions): string;
    /**
     * Verify whether the target application directory already exists.
     *
     * @param $directory - Absolute target directory path.
     */
    verifyApplicationDoesntExist($directory: string): void;
    /**
     * Replace occurrences of a substring inside a target file.
     *
     * @param $search - String to search for.
     * @param $replace - Replacement string.
     * @param $file - Target file path.
     */
    replaceInFile($search: string | RegExp, $replace: string, $file: string): void;
    /**
     * Resolves the TypeScript compiler binary path bundled with the installer.
     *
     * @returns Full executable command for tsc.
     */
    getTscCommand(): string;
    /**
     * Resolve a module identifier path.
     *
     * @param moduleId - Module specifier to resolve.
     * @returns Resolved module filesystem path.
     */
    resolveModule(moduleId: string): string;
    /**
     * Builds the application using the bundled TypeScript compiler.
     *
     * @param directory - Application root directory path.
     */
    buildWithTsc(directory: string): Promise<void>;
    /**
     * Converts a scaffolded OstroJS application to pure JavaScript.
     *
     * @param directory - Application root directory path.
     * @param builder - Asset bundler ('vite' or 'mix').
     */
    convertToJavaScript(directory: string, builder?: 'vite' | 'mix'): Promise<void>;
    /**
     * Update assistant executable to pure JavaScript without ts-node or checks.
     *
     * @param directory - Application root directory path.
     */
    updateAssistantForJavaScript(directory: string): void;
    /**
     * Update Jest configuration for pure JavaScript mode.
     *
     * @param directory - Application root directory path.
     */
    updateJestConfigForJavaScript(directory: string): void;
    /**
     * Configure asset pipeline (Vite or Laravel Mix) for JavaScript or TypeScript mode.
     *
     * @param directory - Application root directory path.
     * @param format - 'js' or 'ts'.
     * @param builder - 'vite' or 'mix'.
     */
    configureAssetPipeline(directory: string, format: 'js' | 'ts', builder: 'vite' | 'mix'): void;
    /**
     * Clean compiled JavaScript files by removing source maps, strict mode,
     * __esModule boilerplate, and mapping indexed identifiers (_1, _2) back
     * to clean variable names.
     *
     * @param dir - Application root directory path.
     */
    cleanJavaScriptArtifacts(dir: string): void;
    /**
     * Clean single compiled JavaScript file contents.
     *
     * @param code - Raw compiled JavaScript content.
     * @returns Cleaned JavaScript content.
     */
    cleanCompiledFile(code: string): string;
    /**
     * Recursively delete TypeScript source files, declaration files, and configs.
     *
     * @param dir - Root or sub-directory to clean.
     */
    removeTypeScriptArtifacts(dir: string): void;
    /**
     * Update package.json to reflect TypeScript linting, bundler, and build configuration.
     *
     * @param directory - Application root directory path.
     * @param builder - Asset bundler ('vite' or 'mix').
     */
    updatePackageJsonForTypeScript(directory: string, builder?: 'vite' | 'mix'): void;
    /**
     * Update package.json to reflect pure JavaScript configuration.
     *
     * @param directory - Application root directory path.
     * @param builder - Asset bundler ('vite' or 'mix').
     */
    updatePackageJsonForJavaScript(directory: string, builder?: 'vite' | 'mix'): void;
    /**
     * Create ESLint configuration for pure JavaScript application.
     *
     * @param directory - Application root directory path.
     */
    createEslintConfigForJavaScript(directory: string): void;
    /**
     * Create ESLint configuration for TypeScript application using @eslint/js and eslint/config.
     *
     * @param directory - Application root directory path.
     */
    createEslintConfigForTypeScript(directory: string): void;
    /**
     * Install linting dependencies for TypeScript application.
     *
     * @param directory - Application root directory path.
     */
    installTypeScriptLintDependencies(directory: string): Promise<void>;
    /**
     * Install linting dependencies for pure JavaScript application.
     *
     * @param directory - Application root directory path.
     */
    installJavaScriptLintDependencies(directory: string): Promise<void>;
    /**
     * Fix bin symlinks created by npm in node_modules/.bin so they don't point to the temporary directory.
     *
     * @param directory - Application root directory path.
     * @param tempWorkingDir - Temporary directory path where npm install ran.
     */
    fixBinSymlinks(directory: string, tempWorkingDir: string): void;
    /**
     * Restore and ensure all .gitignore files (root, public, database, storage) in crafted application.
     *
     * @param directory - Application root directory path.
     */
    ensureGitignoreFiles(directory: string): void;
}
export default NewCommand;
//# sourceMappingURL=newCommand.d.ts.map