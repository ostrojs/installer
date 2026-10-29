"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_child_process_1 = __importDefault(require("node:child_process"));
const node_readline_1 = __importDefault(require("node:readline"));
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const command_1 = __importDefault(require("@ostro/console/command"));
/**
 * Command class for initializing a new OstroJS application across Linux, macOS, and Windows.
 */
class NewCommand extends command_1.default {
    /**
     * The console command signature.
     */
    get $signature() {
        return 'new';
    }
    /**
     * The console command description.
     */
    get $description() {
        return 'Create a new OstroJS application';
    }
    /**
     * The console command options definition.
     */
    get $options() {
        return [
            this.createOption('--dev', 'Installs the latest "development" release'),
            this.createOption('--force', 'Forces install even if the directory already exists').default(false),
            this.createOption('--format <type>', 'Format of the application framework (js or ts)').default('ts').choices(['js', 'ts']),
            this.createOption('--builder <type>', 'Frontend asset bundler (vite or mix)').default('vite').choices(['vite', 'mix'])
        ];
    }
    /**
     * The console command arguments definition.
     */
    get $arguments() {
        return [
            this.createArgument('name', 'The name of the application').required(),
            this.createArgument('format', 'The format of the application (js or ts)')
        ];
    }
    /**
     * Active spinner timer instance.
     */
    spinnerTimer = null;
    /**
     * Execute the console command.
     *
     * @returns A promise that resolves when installation completes.
     */
    async handle() {
        let directoryCreated = false;
        let $directory = '.';
        let tempWorkingDir = null;
        try {
            this.output.writeln(`<fg=cyan> 
                ___
              /     \\
             /       \\_____ \_____ _______\_\__
            |        / ___\|   \|   | \'__/  _  \\
            |        \\___ \\   |   | | \|  (_)  \|
             \\       /____\/   |   | |  \\ ___ \/
               \\ ___ /                     
            
             
         </>`);
            const $name = this.input.getArgument('name');
            $directory = $name !== '.' ? node_path_1.default.resolve(process.cwd(), $name) : '.';
            if (!this.input.getOption('force')) {
                this.verifyApplicationDoesntExist($directory);
            }
            if (this.input.getOption('force') && $directory === '.') {
                throw new Error('Cannot use --force option when using current directory for installation!');
            }
            const $currentVersion = (this.runCommandsSync(['npm show @ostro/installer version']) || '').trim();
            let $existingVersion = (this.runCommandsSync(['npm ls @ostro/installer -g version --depth=0']) || '');
            $existingVersion = $existingVersion.replace(/[^@]*@ostro\/installer@([\w.-]+)\s*/, '$1').trim();
            this.output.write('[1/7] ');
            const versionMessage = $existingVersion === $currentVersion
                ? '@ostro/installer version verified'
                : 'Update required: "npm install @ostro/installer@latest -g"';
            if ($existingVersion !== $currentVersion) {
                this.error(versionMessage);
            }
            else {
                this.info(versionMessage);
            }
            const formatArg = String(this.input.getArgument('format') || '').toLowerCase();
            const formatOption = String(this.input.getOption('format') || 'ts').toLowerCase();
            const chosenFormat = (formatArg === 'js' || formatArg === 'ts') ? formatArg : formatOption;
            const format = chosenFormat === 'js' ? 'js' : 'ts';
            const builderOption = String(this.input.getOption('builder') || 'vite').toLowerCase();
            const builder = builderOption === 'mix' ? 'mix' : 'vite';
            const osType = node_os_1.default.type();
            if ($directory !== '.' && this.input.getOption('force')) {
                try {
                    node_fs_1.default.rmSync($directory, { force: true, recursive: true });
                }
                catch (e) {
                    this.error(e);
                }
            }
            tempWorkingDir = node_fs_1.default.mkdtempSync(node_path_1.default.join(node_os_1.default.tmpdir(), 'ostro-install-'));
            const targetPkg = this.input.getOption('dev') ? '@ostro/ostro@dev' : '@ostro/ostro@alpha';
            const registryFlag = process.env.npm_config_registry ? ` --registry ${process.env.npm_config_registry}` : '';
            let $url = (this.runCommandsSync([`npm v ${targetPkg} dist.tarball${registryFlag}`]) || '').trim();
            if (!$url) {
                $url = (this.runCommandsSync([`npm v @ostro/ostro dist.tarball${registryFlag}`]) || '').trim();
            }
            const $commands = [];
            if (osType === 'Windows_NT') {
                $commands.push(`powershell -Command "Invoke-WebRequest -Uri '${$url.trim()}' -OutFile 'ostro.tar.gz'"`, `tar -xzf ostro.tar.gz --strip 1`, `powershell -Command "Remove-Item -Force 'ostro.tar.gz'"`);
            }
            else {
                $commands.push(`curl -s "${$url.trim()}" | tar -xzf - --strip 1`, `chmod 755 "${node_path_1.default.join(tempWorkingDir, 'assistant')}"`);
            }
            this.startSpinner('[2/7]', 'Crafting application in staging...');
            await this.runCommandsAsync($commands, { cwd: tempWorkingDir });
            // Restore all .gitignore files (including root and subdirectories)
            this.ensureGitignoreFiles(tempWorkingDir);
            this.stopSpinnerAndClear();
            this.output.write('[2/7] ');
            this.info('Application crafted');
            const envExamplePath = node_path_1.default.join(tempWorkingDir, '.env.example');
            const envPath = node_path_1.default.join(tempWorkingDir, '.env');
            if (node_fs_1.default.existsSync(envExamplePath)) {
                node_fs_1.default.copyFileSync(envExamplePath, envPath);
            }
            this.output.write('[3/7] ');
            this.info('Environment file generated');
            // Real-time single-line npm install log cross-platform (Debian, Linux, macOS, Windows)
            this.updateSingleLine('[4/7]', 'Installing dependencies...');
            await this.runNpmInstallWithRealtimeLog(tempWorkingDir, '[4/7]');
            this.clearLine();
            this.output.write('[4/7] ');
            this.info('Dependencies installed');
            if (format === 'js') {
                this.startSpinner('[5/7]', 'Building & converting to pure JavaScript...');
                await this.convertToJavaScript(tempWorkingDir, builder);
                this.stopSpinnerAndClear();
                this.output.write('[5/7] ');
                this.info('Pure JavaScript framework built');
            }
            else {
                this.startSpinner('[5/7]', 'Building TypeScript framework...');
                this.configureAssetPipeline(tempWorkingDir, 'ts', builder);
                this.updatePackageJsonForTypeScript(tempWorkingDir, builder);
                this.createEslintConfigForTypeScript(tempWorkingDir);
                await this.installTypeScriptLintDependencies(tempWorkingDir);
                await this.buildWithTsc(tempWorkingDir);
                this.stopSpinnerAndClear();
                this.output.write('[5/7] ');
                this.info('TypeScript framework built');
            }
            this.startSpinner('[6/7]', 'Generating application key...');
            const keyGenCmd = 'node assistant key:generate';
            await this.runCommandsAsync([keyGenCmd], { cwd: tempWorkingDir });
            this.stopSpinnerAndClear();
            this.output.write('[6/7] ');
            this.info('Key generated');
            this.startSpinner('[7/7]', 'Publishing to destination directory...');
            node_fs_1.default.mkdirSync($directory, { recursive: true });
            directoryCreated = true;
            node_fs_1.default.cpSync(tempWorkingDir, $directory, { recursive: true });
            this.fixBinSymlinks($directory, tempWorkingDir);
            this.stopSpinnerAndClear();
            try {
                node_fs_1.default.rmSync(tempWorkingDir, { recursive: true, force: true });
                tempWorkingDir = null;
            }
            catch (_) { }
            this.output.write('[7/7] ');
            this.info(`Application ready at destination (${format.toUpperCase()})`);
            process.stdout.write('\n\n');
            this.output.writeln('<comment>Application ready! Build something amazing.</comment>');
            process.stdout.write('\n');
            this.output.writeln('<fg=cyan>cd ' + $name + '</fg>');
            this.output.writeln('<fg=cyan>npm run server:start</fg>');
        }
        catch (error) {
            this.stopSpinnerAndClear();
            if (tempWorkingDir) {
                try {
                    node_fs_1.default.rmSync(tempWorkingDir, { force: true, recursive: true });
                }
                catch (_) { }
            }
            process.stdout.write('\n');
            let errorDetails = error.message;
            if (error.stdout)
                errorDetails += '\n' + error.stdout.toString();
            if (error.stderr)
                errorDetails += '\n' + error.stderr.toString();
            this.error(`\nInstallation failed: ${errorDetails}`);
            if (directoryCreated && $directory !== '.') {
                try {
                    node_fs_1.default.rmSync($directory, { force: true, recursive: true });
                    this.info(`Auto-removed failed directory: ${$directory}`);
                }
                catch (_) { }
            }
            process.exit(1);
        }
    }
    /**
     * Start an animated progress spinner for a given step.
     *
     * @param prefix - Step identifier (e.g. '[3/7]').
     * @param label - Progress label message.
     */
    startSpinner(prefix, label) {
        const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i = 0;
        this.stopSpinner();
        this.spinnerTimer = setInterval(() => {
            const frame = frames[i++ % frames.length];
            this.updateSingleLine(prefix, `${frame} ${label}`);
        }, 80);
    }
    /**
     * Stop the currently running progress spinner.
     */
    stopSpinner() {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = null;
        }
    }
    /**
     * Stop the active spinner and clear the current stdout terminal line.
     */
    stopSpinnerAndClear() {
        this.stopSpinner();
        this.clearLine();
    }
    /**
     * Update the current terminal line with a single line message.
     *
     * @param prefix - Step label or prefix.
     * @param text - Message text to display.
     */
    updateSingleLine(prefix, text) {
        if (process.stdout.isTTY) {
            node_readline_1.default.clearLine(process.stdout, 0);
            node_readline_1.default.cursorTo(process.stdout, 0);
            const cols = process.stdout.columns || 80;
            let fullMsg = `${prefix} ${text}`;
            if (fullMsg.length > cols - 2) {
                fullMsg = fullMsg.substring(0, cols - 5) + '...';
            }
            process.stdout.write(fullMsg);
        }
    }
    /**
     * Clear the current line on TTY terminal output.
     */
    clearLine() {
        if (process.stdout.isTTY) {
            node_readline_1.default.clearLine(process.stdout, 0);
            node_readline_1.default.cursorTo(process.stdout, 0);
        }
    }
    /**
     * Run `npm install` asynchronously while streaming real-time output on a single line.
     * Uses system shell context and an active spinner to ensure non-blocking execution across OSes.
     *
     * @param directory - Path to the target directory.
     * @param prefix - Step label prefix.
     * @returns A promise that resolves when installation completes.
     */
    runNpmInstallWithRealtimeLog(directory, prefix) {
        return new Promise((resolve, reject) => {
            const registryFlag = process.env.npm_config_registry ? ` --registry ${process.env.npm_config_registry}` : '';
            const child = node_child_process_1.default.exec(`npm install${registryFlag}`, { cwd: directory });
            const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            let i = 0;
            let lastLogLine = 'Starting npm install...';
            const timer = setInterval(() => {
                const frame = frames[i++ % frames.length];
                this.updateSingleLine(prefix, `${frame} Installing... ${lastLogLine}`);
            }, 80);
            const handleOutput = (data) => {
                const lines = data.toString().split('\n').filter((line) => Boolean(line.trim()));
                if (lines.length > 0) {
                    lastLogLine = lines[lines.length - 1].trim();
                }
            };
            child.stdout.on('data', handleOutput);
            child.stderr.on('data', handleOutput);
            child.on('close', (code) => {
                clearInterval(timer);
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`npm install failed with exit code ${code}`));
                }
            });
            child.on('error', (err) => {
                clearInterval(timer);
                reject(err);
            });
        });
    }
    /**
     * Execute shell commands asynchronously and return a Promise.
     *
     * @param commands - List of commands to execute sequentially.
     * @param options - Additional options for child_process.exec (e.g. { cwd }).
     * @returns Output from executed commands.
     */
    runCommandsAsync(commands, options = {}) {
        return new Promise((resolve, reject) => {
            const cmd = commands.join(' && ');
            node_child_process_1.default.exec(cmd, { encoding: 'utf8', ...options }, (error, stdout, stderr) => {
                if (error) {
                    const err = new Error(stderr || stdout || error.message);
                    err.stdout = stdout;
                    err.stderr = stderr;
                    reject(err);
                }
                else {
                    resolve(stdout);
                }
            });
        });
    }
    /**
     * Execute shell commands synchronously.
     *
     * @param commands - List of commands to execute.
     * @param options - Additional options for child_process.execSync.
     * @returns Standard output from execution.
     */
    runCommandsSync(commands, options = {}) {
        return node_child_process_1.default.execSync(commands.join(' && '), { encoding: 'utf8', ...options });
    }
    /**
     * Verify whether the target application directory already exists.
     *
     * @param $directory - Absolute target directory path.
     */
    verifyApplicationDoesntExist($directory) {
        try {
            const stat = node_fs_1.default.statSync($directory);
            if ((stat.isDirectory() || stat.isFile()) && $directory !== process.cwd()) {
                this.error('Application already exists!');
                process.exit(1);
            }
        }
        catch (_e) {
            // Path does not exist, which is expected
        }
    }
    /**
     * Replace occurrences of a substring inside a target file.
     *
     * @param $search - String to search for.
     * @param $replace - Replacement string.
     * @param $file - Target file path.
     */
    replaceInFile($search, $replace, $file) {
        node_fs_1.default.writeFileSync($file, node_fs_1.default.readFileSync($file, 'utf8').replace($search, $replace));
    }
    /**
     * Resolves the TypeScript compiler binary path bundled with the installer.
     *
     * @returns Full executable command for tsc.
     */
    getTscCommand() {
        try {
            const tscPath = this.resolveModule('typescript/bin/tsc');
            return `"${process.execPath}" "${tscPath}"`;
        }
        catch (_) {
            return 'npx tsc';
        }
    }
    /**
     * Resolve a module identifier path.
     *
     * @param moduleId - Module specifier to resolve.
     * @returns Resolved module filesystem path.
     */
    resolveModule(moduleId) {
        return require.resolve(moduleId);
    }
    /**
     * Builds the application using the bundled TypeScript compiler.
     *
     * @param directory - Application root directory path.
     */
    async buildWithTsc(directory) {
        const tscCmd = this.getTscCommand();
        const configPath = node_fs_1.default.existsSync(node_path_1.default.join(directory, 'tsconfig.json'))
            ? 'tsconfig.json'
            : (node_fs_1.default.existsSync(node_path_1.default.join(directory, 'tsconfig.build.json')) ? 'tsconfig.build.json' : 'tsconfig.json');
        await this.runCommandsAsync([`${tscCmd} -p ${configPath}`], { cwd: directory });
    }
    /**
     * Converts a scaffolded OstroJS application to pure JavaScript.
     *
     * @param directory - Application root directory path.
     * @param builder - Asset bundler ('vite' or 'mix').
     */
    async convertToJavaScript(directory, builder = 'vite') {
        await this.buildWithTsc(directory);
        const distDir = node_path_1.default.join(directory, '.dist');
        if (node_fs_1.default.existsSync(distDir)) {
            node_fs_1.default.cpSync(distDir, directory, { recursive: true });
            node_fs_1.default.rmSync(distDir, { recursive: true, force: true });
        }
        this.cleanJavaScriptArtifacts(directory);
        this.removeTypeScriptArtifacts(directory);
        this.configureAssetPipeline(directory, 'js', builder);
        this.updatePackageJsonForJavaScript(directory, builder);
        this.createEslintConfigForJavaScript(directory);
        await this.installJavaScriptLintDependencies(directory);
        this.updateAssistantForJavaScript(directory);
        this.updateJestConfigForJavaScript(directory);
    }
    /**
     * Update assistant executable to pure JavaScript without ts-node or checks.
     *
     * @param directory - Application root directory path.
     */
    updateAssistantForJavaScript(directory) {
        const assistantPath = node_path_1.default.join(directory, 'assistant');
        const content = [
            '#!/usr/bin/env node',
            '',
            "const appModule = require('./bootstrap/app');",
            'const app = appModule && appModule.default ? appModule.default : appModule;',
            '',
            "const kernel = app.make('@ostro/contracts/console/kernel');",
            '',
            'kernel.handle(',
            '    process.argv.slice(2),',
            ');',
            ''
        ].join('\n');
        node_fs_1.default.writeFileSync(assistantPath, content, { mode: 0o755 });
    }
    /**
     * Update Jest configuration for pure JavaScript mode.
     *
     * @param directory - Application root directory path.
     */
    updateJestConfigForJavaScript(directory) {
        const configPath = node_path_1.default.join(directory, 'jest.config.js');
        const content = [
            'module.exports = {',
            "    testEnvironment: 'node',",
            '    testMatch: [',
            "        '**/test/**/*.test.js'",
            '    ],',
            '    modulePathIgnorePatterns: [',
            "        '<rootDir>/build',",
            "        '<rootDir>/.dist'",
            '    ],',
            '    moduleNameMapper: {',
            "        '^~/(.*)$': '<rootDir>/$1'",
            '    },',
            '    collectCoverage: true,',
            "    coverageDirectory: 'coverage',",
            '    coverageReporters: [',
            "        'text',",
            "        'lcov',",
            "        'clover'",
            '    ],',
            '    collectCoverageFrom: [',
            "        '<rootDir>/app/**/*.js',",
            "        '<rootDir>/bootstrap/app.js',",
            "        '<rootDir>/routes/**/*.js',",
            "        '<rootDir>/database/migrations/**/*.js',",
            "        '<rootDir>/database/seeders/**/*.js',",
            "        '!<rootDir>/node_modules/**',",
            "        '!<rootDir>/test/**',",
            "        '!<rootDir>/coverage/**'",
            '    ]',
            '};',
            ''
        ].join('\n');
        node_fs_1.default.writeFileSync(configPath, content, 'utf8');
        try {
            const tsJestConfig = node_path_1.default.join(directory, 'jest.config.ts');
            if (node_fs_1.default.existsSync(tsJestConfig))
                node_fs_1.default.unlinkSync(tsJestConfig);
        }
        catch (_) { }
    }
    /**
     * Configure asset pipeline (Vite or Laravel Mix) for JavaScript or TypeScript mode.
     *
     * @param directory - Application root directory path.
     * @param format - 'js' or 'ts'.
     * @param builder - 'vite' or 'mix'.
     */
    configureAssetPipeline(directory, format, builder) {
        const ext = format === 'js' ? 'js' : 'ts';
        if (builder === 'mix') {
            const mixPath = node_path_1.default.join(directory, `webpack.mix.${ext}`);
            const content = [
                "const mix = require('@ostro/mix');",
                '',
                '/*',
                ' |--------------------------------------------------------------------------',
                ' | Mix Asset Management',
                ' |--------------------------------------------------------------------------',
                ' |',
                ' | Mix provides a clean, fluent API for defining Webpack build steps',
                ' | for your OstroJS applications.',
                ' |',
                ' */',
                '',
                format === 'ts'
                    ? "mix.ts('resources/assets/js/app.ts', 'public/js')"
                    : "mix.js('resources/assets/js/app.js', 'public/js')",
                "    .postCss('resources/assets/css/app.css', 'public/css', [",
                '        //',
                '    ]);',
                ''
            ].join('\n');
            node_fs_1.default.writeFileSync(mixPath, content, 'utf8');
            // Remove unused vite configs and redundant mix extension
            const otherExt = format === 'js' ? 'ts' : 'js';
            const redundantMix = node_path_1.default.join(directory, `webpack.mix.${otherExt}`);
            const viteTs = node_path_1.default.join(directory, 'vite.config.ts');
            const viteJs = node_path_1.default.join(directory, 'vite.config.js');
            try {
                if (node_fs_1.default.existsSync(redundantMix))
                    node_fs_1.default.unlinkSync(redundantMix);
            }
            catch (_) { }
            try {
                if (node_fs_1.default.existsSync(viteTs))
                    node_fs_1.default.unlinkSync(viteTs);
            }
            catch (_) { }
            try {
                if (node_fs_1.default.existsSync(viteJs))
                    node_fs_1.default.unlinkSync(viteJs);
            }
            catch (_) { }
        }
        else {
            // Default: Vite
            const vitePath = node_path_1.default.join(directory, `vite.config.${ext}`);
            const scriptEntry = `resources/assets/js/app.${ext}`;
            const content = [
                "import { defineConfig } from 'vite';",
                "import ostro from '@ostro/vite';",
                '',
                'export default defineConfig({',
                '    plugins: [',
                '        ostro({',
                '            input: [',
                "                'resources/assets/css/app.css',",
                `                '${scriptEntry}',`,
                '            ],',
                '            refresh: true,',
                '        }),',
                '    ],',
                '});',
                ''
            ].join('\n');
            node_fs_1.default.writeFileSync(vitePath, content, 'utf8');
            // Remove unused mix configs and redundant vite extension
            const otherExt = format === 'js' ? 'ts' : 'js';
            const redundantVite = node_path_1.default.join(directory, `vite.config.${otherExt}`);
            const mixTs = node_path_1.default.join(directory, 'webpack.mix.ts');
            const mixJs = node_path_1.default.join(directory, 'webpack.mix.js');
            try {
                if (node_fs_1.default.existsSync(redundantVite))
                    node_fs_1.default.unlinkSync(redundantVite);
            }
            catch (_) { }
            try {
                if (node_fs_1.default.existsSync(mixTs))
                    node_fs_1.default.unlinkSync(mixTs);
            }
            catch (_) { }
            try {
                if (node_fs_1.default.existsSync(mixJs))
                    node_fs_1.default.unlinkSync(mixJs);
            }
            catch (_) { }
        }
    }
    /**
     * Clean compiled JavaScript files by removing source maps, strict mode,
     * __esModule boilerplate, and mapping indexed identifiers (_1, _2) back
     * to clean variable names.
     *
     * @param dir - Application root directory path.
     */
    cleanJavaScriptArtifacts(dir) {
        const entries = node_fs_1.default.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = node_path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git') {
                    this.cleanJavaScriptArtifacts(fullPath);
                }
            }
            else if (entry.name.endsWith('.js.map') || entry.name.endsWith('.map')) {
                try {
                    node_fs_1.default.unlinkSync(fullPath);
                }
                catch (_) { }
            }
            else if (entry.name.endsWith('.js')) {
                try {
                    const originalContent = node_fs_1.default.readFileSync(fullPath, 'utf8');
                    const cleanedContent = this.cleanCompiledFile(originalContent);
                    if (cleanedContent !== originalContent) {
                        node_fs_1.default.writeFileSync(fullPath, cleanedContent);
                    }
                }
                catch (_) { }
            }
        }
    }
    /**
     * Clean single compiled JavaScript file contents.
     *
     * @param code - Raw compiled JavaScript content.
     * @returns Cleaned JavaScript content.
     */
    cleanCompiledFile(code) {
        // 1. Remove sourceMappingURL
        code = code.replace(/\/\/#\s*sourceMappingURL=.*$/gm, '');
        // 2. Remove "use strict";
        code = code.replace(/^["']use strict["'];?\r?\n?/gm, '');
        // 3. Remove Object.defineProperty(exports, "__esModule", { value: true });
        code = code.replace(/Object\.defineProperty\(exports,\s*["']__esModule["'],\s*\{\s*value:\s*true\s*\}\);?\r?\n?/gm, '');
        // 3b. Remove __createBinding, __setModuleDefault, __importDefault, and __importStar helper boilerplate and unwrap require
        code = code.replace(/var __createBinding\s*=\s*[\s\S]*?\n\}\)\);\r?\n?/gm, '');
        code = code.replace(/var __setModuleDefault\s*=\s*[\s\S]*?\n\}\);\r?\n?/gm, '');
        code = code.replace(/var __importDefault\s*=\s*[\s\S]*?\n\}\);?\r?\n?/gm, '');
        code = code.replace(/var __importStar\s*=\s*[\s\S]*?\n\}\)\(\);?\r?\n?/gm, '');
        code = code.replace(/const\s+([a-zA-Z0-9_$]+)\s*=\s*__importDefault\(\s*require\(([^)]+)\)\s*\);?/gm, 'const $1 = require($2);');
        code = code.replace(/const\s+([a-zA-Z0-9_$]+)\s*=\s*__importStar\(\s*require\(([^)]+)\)\s*\);?/gm, 'const $1 = require($2);');
        const reserved = new Set([
            'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete',
            'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in',
            'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
            'var', 'void', 'while', 'with', 'yield'
        ]);
        // 4. Transform (0, helper.fn)(...) to fn(...) with destructuring
        const importUsages = new Map();
        const callRegex = /\(0,\s*([a-zA-Z0-9_$]+)\.([a-zA-Z0-9_$]+)\)\(/g;
        let m;
        while ((m = callRegex.exec(code)) !== null) {
            const varName = m[1];
            const fnName = m[2];
            if (!importUsages.has(varName)) {
                importUsages.set(varName, new Set());
            }
            importUsages.get(varName).add(fnName);
        }
        for (const [varName, fns] of importUsages.entries()) {
            const reqRegex = new RegExp(`const\\s+${varName}\\s*=\\s*require\\(([^)]+)\\);?`);
            if (reqRegex.test(code)) {
                const fnList = Array.from(fns).join(', ');
                code = code.replace(reqRegex, (_m, p1) => `const { ${fnList} } = require(${p1});`);
                for (const fn of fns) {
                    const replaceCall = new RegExp(`\\(0,\\s*${varName}\\.${fn}\\)\\(`, 'g');
                    code = code.replace(replaceCall, `${fn}(`);
                }
            }
        }
        // Fallback for any remaining (0, obj.fn)(...)
        code = code.replace(/\(0,\s*([a-zA-Z0-9_$]+)\.([a-zA-Z0-9_$]+)\)\(/g, (_m, obj, method) => {
            if (obj.endsWith('Helper')) {
                return `${method}(`;
            }
            return `${obj}.${method}(`;
        });
        // 5. Map remaining _1, _2 back to actual identifiers without _interop
        const varMap = new Map();
        const requiredVars = new Set();
        const requireRegex = /const\s+([a-zA-Z0-9_$]+)_(\d+)\s*=\s*require\((["'][^"']+["'])\);?/g;
        let match;
        while ((match = requireRegex.exec(code)) !== null) {
            const fullVar = `${match[1]}_${match[2]}`;
            const baseName = match[1];
            const num = match[2];
            let cleanName = num === '1' ? baseName : `${baseName}${num}`;
            if (reserved.has(cleanName)) {
                cleanName = `${cleanName}Helper`;
            }
            varMap.set(fullVar, cleanName);
            requiredVars.add(cleanName);
        }
        const singleRequireRegex = /const\s+([a-zA-Z0-9_$]+)\s*=\s*require\((["'][^"']+["'])\);?/g;
        while ((match = singleRequireRegex.exec(code)) !== null) {
            if (!match[1].includes('_')) {
                requiredVars.add(match[1]);
            }
        }
        for (const [oldVar, newVar] of varMap.entries()) {
            const declRegex = new RegExp(`const\\s+${oldVar}\\s*=\\s*require\\(([^)]+)\\);?`, 'g');
            code = code.replace(declRegex, `const ${newVar} = require($1);`);
            const usageRegex = new RegExp(`\\b${oldVar}\\b`, 'g');
            code = code.replace(usageRegex, newVar);
        }
        // 6. Remove .default property accessors everywhere on imported variables
        for (const v of requiredVars) {
            const defaultPropRegex = new RegExp(`\\b${v}\\.default\\b`, 'g');
            code = code.replace(defaultPropRegex, v);
        }
        code = code.replace(/\b([a-zA-Z0-9_$]+)\.default\b(?!\s*[:=])/g, '$1');
        // 7. Ensure clean direct module.exports without default
        code = code.replace(/^exports\.default\s*=\s*/gm, 'module.exports = ');
        code = code.replace(/^module\.exports\.default\s*=\s*[^;]+;?\r?\n?/gm, '');
        // 8. Ensure extended classes safely unwrap default if compiled from ESM
        code = code.replace(/class\s+([a-zA-Z0-9_$]+)\s+extends\s+([a-zA-Z0-9_$]+)\s*\{/g, 'class $1 extends ($2.default || $2) {');
        return code.trim() + '\n';
    }
    /**
     * Recursively delete TypeScript source files, declaration files, and configs.
     *
     * @param dir - Root or sub-directory to clean.
     */
    removeTypeScriptArtifacts(dir) {
        const entries = node_fs_1.default.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = node_path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git') {
                    this.removeTypeScriptArtifacts(fullPath);
                }
            }
            else if (entry.name.endsWith('.ts') ||
                entry.name.endsWith('.d.ts') ||
                entry.name.endsWith('.d.ts.map') ||
                entry.name.endsWith('.map') ||
                entry.name === 'tsconfig.json' ||
                entry.name === 'tsconfig.build.json') {
                try {
                    node_fs_1.default.unlinkSync(fullPath);
                }
                catch (_) { }
            }
        }
    }
    /**
     * Update package.json to reflect TypeScript linting, bundler, and build configuration.
     *
     * @param directory - Application root directory path.
     * @param builder - Asset bundler ('vite' or 'mix').
     */
    updatePackageJsonForTypeScript(directory, builder = 'vite') {
        const pkgPath = node_path_1.default.join(directory, 'package.json');
        if (!node_fs_1.default.existsSync(pkgPath))
            return;
        const pkg = JSON.parse(node_fs_1.default.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts) {
            pkg.scripts['lint:check'] = 'eslint .';
            pkg.scripts['lint:fix'] = 'eslint . --fix';
            pkg.scripts['dev'] = 'npm run development';
            if (builder === 'mix') {
                delete pkg.scripts['vite'];
                pkg.scripts['development'] = 'mix --mix-config=webpack.mix.ts';
                pkg.scripts['watch'] = 'mix watch --mix-config=webpack.mix.ts';
                pkg.scripts['watch-poll'] = 'mix watch --mix-config=webpack.mix.ts -- --watch-options-poll=1000';
                pkg.scripts['hot'] = 'mix watch --hot --mix-config=webpack.mix.ts';
                pkg.scripts['prod'] = 'npm run production';
                pkg.scripts['production'] = 'mix --production --mix-config=webpack.mix.ts';
            }
            else {
                delete pkg.scripts['hot'];
                pkg.scripts['development'] = 'vite build';
                pkg.scripts['watch'] = 'vite build --watch';
                pkg.scripts['watch-poll'] = 'vite build --watch';
                pkg.scripts['vite'] = 'vite';
                pkg.scripts['prod'] = 'npm run production';
                pkg.scripts['production'] = 'vite build';
            }
            pkg.scripts['build'] = 'npm run lint:check && ostro-build';
        }
        if (builder === 'mix') {
            if (pkg.devDependencies) {
                delete pkg.devDependencies['@ostro/vite'];
                delete pkg.devDependencies['vite'];
                pkg.devDependencies['@ostro/mix'] = '^2.0.0-alpha.1';
                pkg.devDependencies['webpack'] = '5.99.9';
                pkg.devDependencies['ts-loader'] = '^9.5.2';
            }
        }
        node_fs_1.default.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
    /**
     * Update package.json to reflect pure JavaScript configuration.
     *
     * @param directory - Application root directory path.
     * @param builder - Asset bundler ('vite' or 'mix').
     */
    updatePackageJsonForJavaScript(directory, builder = 'vite') {
        const pkgPath = node_path_1.default.join(directory, 'package.json');
        if (!node_fs_1.default.existsSync(pkgPath))
            return;
        const pkg = JSON.parse(node_fs_1.default.readFileSync(pkgPath, 'utf8'));
        pkg.main = 'app.js';
        delete pkg.types;
        if (pkg.scripts) {
            delete pkg.scripts['build:clean'];
            delete pkg.scripts.start;
            delete pkg.scripts.server;
            delete pkg.scripts['start:prod'];
            pkg.scripts['lint:check'] = 'eslint .';
            pkg.scripts['lint:fix'] = 'eslint . --fix';
            pkg.scripts['dev'] = 'npm run development';
            if (builder === 'mix') {
                delete pkg.scripts['vite'];
                pkg.scripts['development'] = 'mix --mix-config=webpack.mix.js';
                pkg.scripts['watch'] = 'mix watch --mix-config=webpack.mix.js';
                pkg.scripts['watch-poll'] = 'mix watch --mix-config=webpack.mix.js -- --watch-options-poll=1000';
                pkg.scripts['hot'] = 'mix watch --hot --mix-config=webpack.mix.js';
                pkg.scripts['prod'] = 'npm run production';
                pkg.scripts['production'] = 'mix --production --mix-config=webpack.mix.js';
            }
            else {
                delete pkg.scripts['hot'];
                pkg.scripts['development'] = 'vite build';
                pkg.scripts['watch'] = 'vite build --watch';
                pkg.scripts['watch-poll'] = 'vite build --watch';
                pkg.scripts['vite'] = 'vite';
                pkg.scripts['prod'] = 'npm run production';
                pkg.scripts['production'] = 'vite build';
            }
            pkg.scripts['build'] = 'npm run lint:check';
            pkg.scripts['server:start'] = 'node app.js';
        }
        if (pkg.devDependencies) {
            delete pkg.devDependencies.typescript;
            delete pkg.devDependencies['@types/node'];
            delete pkg.devDependencies['ts-node'];
            delete pkg.devDependencies.tsx;
            delete pkg.devDependencies['@ostro/builder'];
            delete pkg.devDependencies['@types/jest'];
            delete pkg.devDependencies['ts-jest'];
            delete pkg.devDependencies['ts-loader'];
            if (builder === 'mix') {
                delete pkg.devDependencies['@ostro/vite'];
                delete pkg.devDependencies['vite'];
                pkg.devDependencies['@ostro/mix'] = '^2.0.0-alpha.1';
                pkg.devDependencies['webpack'] = '5.99.9';
            }
            pkg.devDependencies.eslint = '^9.20.0';
        }
        else {
            pkg.devDependencies = { eslint: '^9.20.0' };
        }
        node_fs_1.default.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }
    /**
     * Create ESLint configuration for pure JavaScript application.
     *
     * @param directory - Application root directory path.
     */
    createEslintConfigForJavaScript(directory) {
        const configPath = node_path_1.default.join(directory, 'eslint.config.js');
        const content = [
            'module.exports = [',
            '    {',
            '        ignores: ["node_modules/**", "public/**", "storage/**", ".dist/**", "build/**", "resources/assets/**"]',
            '    },',
            '    {',
            '        files: ["**/*.js"],',
            '        languageOptions: {',
            '            ecmaVersion: 2022,',
            '            sourceType: "commonjs",',
            '            globals: {',
            '                process: "readonly",',
            '                __dirname: "readonly",',
            '                __filename: "readonly",',
            '                module: "readonly",',
            '                exports: "writable",',
            '                require: "readonly",',
            '                console: "readonly",',
            '                setTimeout: "readonly",',
            '                clearTimeout: "readonly",',
            '                setInterval: "readonly",',
            '                clearInterval: "readonly",',
            '                setImmediate: "readonly",',
            '                clearImmediate: "readonly",',
            '                Buffer: "readonly"',
            '            }',
            '        },',
            '        rules: {',
            '            "no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],',
            '            "no-undef": "error"',
            '        }',
            '    }',
            '];',
            ''
        ].join('\n');
        node_fs_1.default.writeFileSync(configPath, content, 'utf8');
    }
    /**
     * Create ESLint configuration for TypeScript application using @eslint/js and eslint/config.
     *
     * @param directory - Application root directory path.
     */
    createEslintConfigForTypeScript(directory) {
        const configPath = node_path_1.default.join(directory, 'eslint.config.ts');
        const content = [
            "import fs from 'node:fs';",
            "import path from 'node:path';",
            "import js from '@eslint/js';",
            "import { defineConfig, globalIgnores } from 'eslint/config';",
            "import tseslint from 'typescript-eslint';",
            '',
            '// Level 1: Read tsconfig as the first-level configuration base',
            "const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');",
            "const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));",
            '',
            "const tsIncludes: string[] = tsconfig.include || ['**/*.ts'];",
            'const tsExcludes: string[] = (tsconfig.exclude || []).map((pattern: string) => {',
            "    if (pattern.startsWith('*')) return pattern;",
            "    return pattern.includes('/') || pattern.includes('*') ? pattern : `${pattern}/**`;",
            '});',
            '',
            '// Level 2: ESLint configuration built on top of tsconfig',
            'export default defineConfig(',
            '    globalIgnores([',
            '        ...tsExcludes,',
            "        '.dist/**',",
            "        'storage/**',",
            "        'public/**',",
            "        'build/**',",
            "        'resources/assets/**',",
            "        'vite.config.*',",
            "        'eslint.config.*',",
            "        'jest.config.*'",
            '    ]),',
            '    js.configs.recommended,',
            '    ...tseslint.configs.recommended,',
            '    {',
            '        files: tsIncludes,',
            '        languageOptions: {',
            '            ecmaVersion: 2022,',
            "            sourceType: 'module'",
            '        },',
            '        rules: {',
            "            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],",
            "            '@typescript-eslint/no-explicit-any': 'off'",
            '        }',
            '    }',
            ');',
            ''
        ].join('\n');
        node_fs_1.default.writeFileSync(configPath, content, 'utf8');
    }
    /**
     * Install linting dependencies for TypeScript application.
     *
     * @param directory - Application root directory path.
     */
    async installTypeScriptLintDependencies(directory) {
        const registryFlag = process.env.npm_config_registry ? ` --registry ${process.env.npm_config_registry}` : '';
        await this.runCommandsAsync([`npm install --save-dev eslint@^9.20.0 @eslint/js@^9.20.0 typescript-eslint@^8.24.0 jiti@^2.4.2${registryFlag}`], { cwd: directory });
    }
    /**
     * Install linting dependencies for pure JavaScript application.
     *
     * @param directory - Application root directory path.
     */
    async installJavaScriptLintDependencies(directory) {
        const registryFlag = process.env.npm_config_registry ? ` --registry ${process.env.npm_config_registry}` : '';
        await this.runCommandsAsync([`npm install --save-dev eslint@^9.20.0${registryFlag}`], { cwd: directory });
    }
    /**
     * Fix bin symlinks created by npm in node_modules/.bin so they don't point to the temporary directory.
     *
     * @param directory - Application root directory path.
     * @param tempWorkingDir - Temporary directory path where npm install ran.
     */
    fixBinSymlinks(directory, tempWorkingDir) {
        const binDir = node_path_1.default.join(directory, 'node_modules', '.bin');
        if (!node_fs_1.default.existsSync(binDir))
            return;
        const normalizedTemp = tempWorkingDir.replace(/^\/private/, '');
        const entries = node_fs_1.default.readdirSync(binDir);
        for (const entry of entries) {
            const symlinkPath = node_path_1.default.join(binDir, entry);
            try {
                const stat = node_fs_1.default.lstatSync(symlinkPath);
                if (stat.isSymbolicLink()) {
                    const target = node_fs_1.default.readlinkSync(symlinkPath);
                    const normalizedTarget = target.replace(/^\/private/, '');
                    if (node_path_1.default.isAbsolute(target) && (target.startsWith(tempWorkingDir) || normalizedTarget.startsWith(normalizedTemp))) {
                        const relPart = normalizedTarget.substring(normalizedTemp.length).replace(/^[/\\]+/, '');
                        const newTarget = node_path_1.default.join(directory, relPart);
                        node_fs_1.default.unlinkSync(symlinkPath);
                        node_fs_1.default.symlinkSync(newTarget, symlinkPath);
                    }
                }
            }
            catch (_) { }
        }
    }
    /**
     * Restore and ensure all .gitignore files (root, public, database, storage) in crafted application.
     *
     * @param directory - Application root directory path.
     */
    ensureGitignoreFiles(directory) {
        if (!node_fs_1.default.existsSync(directory))
            return;
        // Convert any 'gitignore' files unpacked from tarball into '.gitignore'
        const convertGitignores = (dir) => {
            if (!node_fs_1.default.existsSync(dir))
                return;
            const entries = node_fs_1.default.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = node_path_1.default.join(dir, entry.name);
                if (entry.isDirectory()) {
                    convertGitignores(fullPath);
                }
                else if (entry.name === 'gitignore') {
                    const dotGitignore = node_path_1.default.join(dir, '.gitignore');
                    if (!node_fs_1.default.existsSync(dotGitignore)) {
                        node_fs_1.default.copyFileSync(fullPath, dotGitignore);
                    }
                    try {
                        node_fs_1.default.unlinkSync(fullPath);
                    }
                    catch (_) { }
                }
            }
        };
        convertGitignores(directory);
        // Ensure standard root .gitignore if missing
        const rootGitignore = node_path_1.default.join(directory, '.gitignore');
        if (!node_fs_1.default.existsSync(rootGitignore)) {
            const defaultRoot = [
                '/.dist',
                '/node_modules',
                '/storage/*.key',
                '.env',
                '.env.backup',
                '.env.example',
                '*.log',
                '.DS_Store',
                'Thumbs.db',
                'npm-debug.log',
                'yarn-error.log',
                'package-lock.json',
                '/.codex',
                '/.cursor/',
                '/.fleet',
                '/.idea',
                '/.nova',
                '/.vscode',
                '/.zed',
                ''
            ].join('\n');
            node_fs_1.default.writeFileSync(rootGitignore, defaultRoot);
        }
        // Ensure public/.gitignore
        const publicDir = node_path_1.default.join(directory, 'public');
        if (node_fs_1.default.existsSync(publicDir)) {
            const publicGitignore = node_path_1.default.join(publicDir, '.gitignore');
            if (!node_fs_1.default.existsSync(publicGitignore)) {
                node_fs_1.default.writeFileSync(publicGitignore, '/build\n/hot\n/storage\n');
            }
        }
        // Ensure database/.gitignore
        const dbDir = node_path_1.default.join(directory, 'database');
        if (node_fs_1.default.existsSync(dbDir)) {
            const dbGitignore = node_path_1.default.join(dbDir, '.gitignore');
            if (!node_fs_1.default.existsSync(dbGitignore)) {
                node_fs_1.default.writeFileSync(dbGitignore, '*.sqlite*\n');
            }
        }
        // Ensure storage/**/.gitignore files
        const storageGitignores = {
            'storage/app': '*\n!public/\n!.gitignore\n',
            'storage/app/public': '*\n!.gitignore\n',
            'storage/framework': 'compiled.json\nconfig.json\ndown\nevents.scanned.json\nmaintenance.json\nroutes.json\nroutes.scanned.json\nschedule-*\nservices.json\n',
            'storage/framework/cache': '*\n!data/\n!.gitignore\n',
            'storage/framework/cache/data': '*\n!.gitignore\n',
            'storage/framework/sessions': '*\n!.gitignore\n',
            'storage/framework/testing': '*\n!.gitignore\n',
            'storage/framework/views': '*\n!.gitignore\n',
            'storage/logs': '*\n!.gitignore\n',
        };
        for (const [relPath, content] of Object.entries(storageGitignores)) {
            const targetDir = node_path_1.default.join(directory, relPath);
            if (node_fs_1.default.existsSync(targetDir)) {
                const gitignoreFile = node_path_1.default.join(targetDir, '.gitignore');
                if (!node_fs_1.default.existsSync(gitignoreFile)) {
                    node_fs_1.default.writeFileSync(gitignoreFile, content);
                }
            }
        }
    }
}
exports.default = NewCommand;
//# sourceMappingURL=.typed/.maps/newCommand.js.map
if (exports.default) {
    const d = exports.default;
    module.exports = d;
    Object.assign(module.exports, exports);
    module.exports.default = d;
}
