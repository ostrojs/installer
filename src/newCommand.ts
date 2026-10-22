import fs from 'fs';
import child_process from 'child_process';
import readline from 'readline';
import os from 'os';
import path from 'path';
import Command from '@ostro/console/command';
import type { ExecOptions, ExecSyncOptions } from 'child_process';

interface NewCommand {
    input: {
        getArgument(name: string): string;
        getOption(name: string): unknown;
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
class NewCommand extends Command {

    /**
     * The console command signature.
     */
    public get $signature(): string {
        return 'new';
    }

    /**
     * The console command description.
     */
    public get $description(): string {
        return 'Create a new OstroJS application';
    }

    /**
     * The console command options definition.
     */
    public get $options(): any[] {
        return [
            this.createOption('--dev', 'Installs the latest "development" release'),
            this.createOption('--force', 'Forces install even if the directory already exists').default(false),
            this.createOption('--format <type>', 'Format of the application framework (js or ts)').default('ts').choices(['js', 'ts'])
        ];
    }

    /**
     * The console command arguments definition.
     */
    public get $arguments(): any[] {
        return [
            this.createArgument('name', 'The name of the application').required(),
            this.createArgument('format', 'The format of the application (js or ts)')
        ];
    }

    /**
     * Active spinner timer instance.
     */
    public spinnerTimer: NodeJS.Timeout | null = null;

    /**
     * Execute the console command.
     *
     * @returns A promise that resolves when installation completes.
     */
    public async handle(): Promise<void> {
        let directoryCreated: boolean = false;
        let $directory: string = '.';
        let tempWorkingDir: string | null = null;
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

            const $name: string = this.input.getArgument('name');
            $directory = $name !== '.' ? path.resolve(process.cwd(), $name) : '.';

            if (!this.input.getOption('force')) {
                this.verifyApplicationDoesntExist($directory);
            }

            if (this.input.getOption('force') && $directory === '.') {
                throw new Error('Cannot use --force option when using current directory for installation!');
            }

            const $currentVersion: string = (this.runCommandsSync(['npm show @ostro/installer version']) || '').trim();
            let $existingVersion: string = (this.runCommandsSync(['npm ls @ostro/installer -g version --depth=0']) || '');
            $existingVersion = $existingVersion.replace(/[^@]*@ostro\/installer@([\w.-]+)\s*/, '$1').trim();

            this.output.write('[1/7] ');
            const versionMessage: string = $existingVersion === $currentVersion
                ? '@ostro/installer version verified'
                : 'Update required: "npm install @ostro/installer@latest -g"';

            if ($existingVersion !== $currentVersion) {
                this.error(versionMessage);
            } else {
                this.info(versionMessage);
            }

            const formatArg: string = String(this.input.getArgument('format') || '').toLowerCase();
            const formatOption: string = String(this.input.getOption('format') || 'ts').toLowerCase();
            const chosenFormat: string = (formatArg === 'js' || formatArg === 'ts') ? formatArg : formatOption;
            const format: 'js' | 'ts' = chosenFormat === 'js' ? 'js' : 'ts';

            const osType: string = os.type();
            if ($directory !== '.' && this.input.getOption('force')) {
                try {
                    fs.rmSync($directory, { force: true, recursive: true });
                } catch (e: unknown) {
                    this.error(e);
                }
            }

            tempWorkingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ostro-install-'));

            const targetPkg: string = this.input.getOption('dev') ? '@ostro/ostro@dev' : '@ostro/ostro@alpha';
            let $url: string = (this.runCommandsSync([`npm v ${targetPkg} dist.tarball`]) || '').trim();
            if (!$url) {
                $url = (this.runCommandsSync(['npm v @ostro/ostro dist.tarball']) || '').trim();
            }
            const $commands: string[] = [];

            if (osType === 'Windows_NT') {
                $commands.push(
                    `powershell -Command "Invoke-WebRequest -Uri '${$url.trim()}' -OutFile 'ostro.tar.gz'"`,
                    `tar -xzf ostro.tar.gz --strip 1`,
                    `powershell -Command "Remove-Item -Force 'ostro.tar.gz'"`
                );
            } else {
                $commands.push(
                    `curl -s "${$url.trim()}" | tar -xzf - --strip 1`,
                    `chmod 755 "${path.join(tempWorkingDir, 'assistant')}"`
                );
            }

            this.startSpinner('[2/7]', 'Crafting application in staging...');
            await this.runCommandsAsync($commands, { cwd: tempWorkingDir });
            this.stopSpinnerAndClear();
            this.output.write('[2/7] ');
            this.info('Application crafted');

            fs.copyFileSync(path.join(tempWorkingDir, '.env.example'), path.join(tempWorkingDir, '.env'));
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
                await this.convertToJavaScript(tempWorkingDir);
                this.stopSpinnerAndClear();
                this.output.write('[5/7] ');
                this.info('Pure JavaScript framework built');
            } else {
                this.startSpinner('[5/7]', 'Building TypeScript framework...');
                await this.buildWithTsc(tempWorkingDir);
                this.copyDistAssets(tempWorkingDir);
                this.stopSpinnerAndClear();
                this.output.write('[5/7] ');
                this.info('TypeScript framework built');
            }

            this.startSpinner('[6/7]', 'Generating application key...');
            await this.runCommandsAsync(['node assistant key:generate'], { cwd: tempWorkingDir });
            this.stopSpinnerAndClear();
            this.output.write('[6/7] ');
            this.info('Key generated');

            if ($name !== '.') {
                const dbName: string = $name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                this.replaceInFile('APP_URL=http://localhost', 'APP_URL=http://' + $name + '.test', path.join(tempWorkingDir, '.env'));
                this.replaceInFile('DB_DATABASE=ostro', 'DB_DATABASE=' + dbName, path.join(tempWorkingDir, '.env'));
                this.replaceInFile('DB_DATABASE=ostro', 'DB_DATABASE=' + dbName, path.join(tempWorkingDir, '.env.example'));
            }

            this.startSpinner('[7/7]', 'Publishing to destination directory...');
            fs.mkdirSync($directory, { recursive: true });
            directoryCreated = true;
            fs.cpSync(tempWorkingDir, $directory, { recursive: true });
            this.fixBinSymlinks($directory, tempWorkingDir);
            this.stopSpinnerAndClear();

            try {
                fs.rmSync(tempWorkingDir, { recursive: true, force: true });
                tempWorkingDir = null;
            } catch (_) { }

            this.output.write('[7/7] ');
            this.info(`Application ready at destination (${format.toUpperCase()})`);
            process.stdout.write('\n\n');
            this.output.writeln('<comment>Application ready! Build something amazing.</comment>');
            process.stdout.write('\n');
            this.output.writeln('<fg=cyan>cd ' + $name + '</fg>');
            this.output.writeln('<fg=cyan>npm run server:start</fg>');
        } catch (error: any) {
            this.stopSpinnerAndClear();
            if (tempWorkingDir) {
                try {
                    fs.rmSync(tempWorkingDir, { force: true, recursive: true });
                } catch (_) { }
            }
            process.stdout.write('\n');
            this.error(`\nInstallation failed: ${error.message}`);

            if (directoryCreated && $directory !== '.') {
                try {
                    fs.rmSync($directory, { force: true, recursive: true });
                    this.info(`Auto-removed failed directory: ${$directory}`);
                } catch (_) { }
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
    public startSpinner(prefix: string, label: string): void {
        const frames: readonly string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let i: number = 0;
        this.stopSpinner();
        this.spinnerTimer = setInterval((): void => {
            const frame: string = frames[i++ % frames.length];
            this.updateSingleLine(prefix, `${frame} ${label}`);
        }, 80);
    }

    /**
     * Stop the currently running progress spinner.
     */
    public stopSpinner(): void {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = null;
        }
    }

    /**
     * Stop the active spinner and clear the current stdout terminal line.
     */
    public stopSpinnerAndClear(): void {
        this.stopSpinner();
        this.clearLine();
    }

    /**
     * Update the current terminal line with a single line message.
     *
     * @param prefix - Step label or prefix.
     * @param text - Message text to display.
     */
    public updateSingleLine(prefix: string, text: string): void {
        if (process.stdout.isTTY) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
            const cols: number = process.stdout.columns || 80;
            let fullMsg: string = `${prefix} ${text}`;
            if (fullMsg.length > cols - 2) {
                fullMsg = fullMsg.substring(0, cols - 5) + '...';
            }
            process.stdout.write(fullMsg);
        }
    }

    /**
     * Clear the current line on TTY terminal output.
     */
    public clearLine(): void {
        if (process.stdout.isTTY) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
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
    public runNpmInstallWithRealtimeLog(directory: string, prefix: string): Promise<void> {
        return new Promise<void>((resolve, reject): void => {
            const child: child_process.ChildProcess = child_process.exec('npm install', { cwd: directory });
            const frames: readonly string[] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            let i: number = 0;
            let lastLogLine: string = 'Starting npm install...';

            const timer: NodeJS.Timeout = setInterval((): void => {
                const frame: string = frames[i++ % frames.length];
                this.updateSingleLine(prefix, `${frame} Installing... ${lastLogLine}`);
            }, 80);

            const handleOutput = (data: string | Buffer): void => {
                const lines: string[] = data.toString().split('\n').filter((line: string): boolean => Boolean(line.trim()));
                if (lines.length > 0) {
                    lastLogLine = lines[lines.length - 1].trim();
                }
            };

            child.stdout!.on('data', handleOutput);
            child.stderr!.on('data', handleOutput);

            child.on('close', (code: number | null): void => {
                clearInterval(timer);
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`npm install failed with exit code ${code}`));
                }
            });

            child.on('error', (err: Error): void => {
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
    public runCommandsAsync(commands: string[], options: ExecOptions = {}): Promise<string> {
        return new Promise<string>((resolve, reject): void => {
            const cmd: string = commands.join(' && ');
            child_process.exec(cmd, { encoding: 'utf8', ...options }, (error: child_process.ExecException | null, stdout: string, stderr: string): void => {
                if (error) {
                    reject(new Error(stderr || error.message));
                } else {
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
    public runCommandsSync(commands: string[], options: ExecSyncOptions = {}): string {
        return child_process.execSync(commands.join(' && '), { encoding: 'utf8', ...options }) as string;
    }

    /**
     * Verify whether the target application directory already exists.
     *
     * @param $directory - Absolute target directory path.
     */
    public verifyApplicationDoesntExist($directory: string): void {
        try {
            const stat: fs.Stats = fs.statSync($directory);
            if ((stat.isDirectory() || stat.isFile()) && $directory !== process.cwd()) {
                this.error('Application already exists!');
                process.exit(1);
            }
        } catch (_e: unknown) {
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
    public replaceInFile($search: string | RegExp, $replace: string, $file: string): void {
        fs.writeFileSync($file, fs.readFileSync($file, 'utf8').replace($search, $replace));
    }

    /**
     * Resolves the TypeScript compiler binary path bundled with the installer.
     *
     * @returns Full executable command for tsc.
     */
    public getTscCommand(): string {
        try {
            const tscPath: string = require.resolve('typescript/bin/tsc');
            return `"${process.execPath}" "${tscPath}"`;
        } catch (_) {
            return 'npx tsc';
        }
    }

    /**
     * Builds the application using the bundled TypeScript compiler.
     *
     * @param directory - Application root directory path.
     */
    public async buildWithTsc(directory: string): Promise<void> {
        const tscCmd: string = this.getTscCommand();
        const configPath: string = fs.existsSync(path.join(directory, 'tsconfig.build.json'))
            ? 'tsconfig.build.json'
            : 'tsconfig.json';
        await this.runCommandsAsync([`${tscCmd} -p ${configPath}`], { cwd: directory });
    }

    /**
     * Parse .gitignore rules from project root.
     *
     * @param directory - Application root directory path.
     * @returns Array of pattern strings.
     */
    public getGitignorePatterns(directory: string): string[] {
        const gitignoreFile: string = path.join(directory, '.gitignore');
        if (!fs.existsSync(gitignoreFile)) return [];
        return fs.readFileSync(gitignoreFile, 'utf8')
            .split('\n')
            .map((l: string) => l.trim())
            .filter((l: string) => Boolean(l) && !l.startsWith('#'));
    }

    /**
     * Checks if a relative path should be ignored by .gitignore rules.
     *
     * @param relPath - Relative file or folder path.
     * @param rules - Array of gitignore rules.
     * @returns True if ignored.
     */
    public isIgnoredByGit(relPath: string, rules: string[]): boolean {
        const norm: string = relPath.replace(/^\//, '');
        for (const r of rules) {
            const clean: string = r.replace(/^\//, '').replace(/\/$/, '');
            if (norm === clean || norm.startsWith(clean + '/')) return true;
            if (clean.startsWith('*') && norm.endsWith(clean.slice(1))) return true;
        }
        return false;
    }

    /**
     * Copies necessary runtime assets (.env, package.json, public, views, and assistant)
     * to .dist directory for deployment, respecting .gitignore rules.
     *
     * @param directory - Application root directory path.
     */
    public copyDistAssets(directory: string): void {
        const distDir: string = path.join(directory, '.dist');
        if (!fs.existsSync(distDir)) {
            fs.mkdirSync(distDir, { recursive: true });
        }

        const rules: string[] = this.getGitignorePatterns(directory);

        // Copy and transpile assistant without extension for nodejs execution in .dist
        const assistantSrc: string = path.join(directory, 'assistant');
        if (fs.existsSync(assistantSrc)) {
            const jsAssistant: string = `#!/usr/bin/env node\n\nconst appModule = require('./bootstrap/app');\nconst app = appModule && appModule.default ? appModule.default : appModule;\n\nconst kernel = app.make('@ostro/contracts/console/kernel');\nkernel.handle(\n    process.argv.slice(2),\n);\n`;
            fs.writeFileSync(path.join(distDir, 'assistant'), jsAssistant, { mode: 0o755 });
        }

        // Copy package.json to .dist and adapt entrypoint to app.js
        const pkgSrc: string = path.join(directory, 'package.json');
        if (fs.existsSync(pkgSrc) && !this.isIgnoredByGit('package.json', rules)) {
            const pkg: any = JSON.parse(fs.readFileSync(pkgSrc, 'utf8'));
            pkg.main = 'app.js';
            delete pkg.types;
            if (pkg.scripts) {
                pkg.scripts['server:start'] = 'node app.js';
                delete pkg.scripts.build;
                delete pkg.scripts['build:clean'];
                delete pkg.scripts.dev;
                delete pkg.scripts.watch;
            }
            fs.writeFileSync(path.join(distDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
        }

        // Copy runtime folders and config files if not gitignored
        const assets: string[] = ['.env', 'public', 'resources/views'];
        for (const item of assets) {
            const s: string = path.join(directory, item);
            const d: string = path.join(distDir, item);
            if (fs.existsSync(s) && !this.isIgnoredByGit(item, rules)) {
                const stat: fs.Stats = fs.statSync(s);
                if (stat.isDirectory()) {
                    fs.cpSync(s, d, { recursive: true });
                } else {
                    fs.copyFileSync(s, d);
                }
            }
        }
    }

    /**
     * Converts a scaffolded OstroJS application to pure JavaScript.
     *
     * @param directory - Application root directory path.
     */
    public async convertToJavaScript(directory: string): Promise<void> {
        await this.buildWithTsc(directory);
        const distDir: string = path.join(directory, '.dist');
        const buildDir: string = path.join(directory, 'build');
        const compiledDir: string = fs.existsSync(distDir) ? distDir : (fs.existsSync(buildDir) ? buildDir : '');
        if (compiledDir) {
            fs.cpSync(compiledDir, directory, { recursive: true });
            fs.rmSync(compiledDir, { recursive: true, force: true });
        }
        const srcDir: string = path.join(directory, 'src');
        if (fs.existsSync(srcDir)) {
            fs.rmSync(srcDir, { recursive: true, force: true });
        }
        this.cleanJavaScriptArtifacts(directory);
        this.removeTypeScriptArtifacts(directory);
        this.updatePackageJsonForJavaScript(directory);

        const assistantPath: string = path.join(directory, 'assistant');
        if (fs.existsSync(assistantPath)) {
            const jsAssistant = `#!/usr/bin/env node\n\nconst appModule = require('./bootstrap/app');\nconst app = appModule && appModule.default ? appModule.default : appModule;\n\nconst kernel = app.make('@ostro/contracts/console/kernel');\nkernel.handle(\n    process.argv.slice(2),\n);\n`;
            fs.writeFileSync(assistantPath, jsAssistant, { mode: 0o755 });
        }
    }

    /**
     * Clean compiled JavaScript files by removing source maps, strict mode,
     * __esModule boilerplate, and mapping indexed identifiers (_1, _2) back
     * to clean variable names.
     *
     * @param dir - Application root directory path.
     */
    public cleanJavaScriptArtifacts(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath: string = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git') {
                    this.cleanJavaScriptArtifacts(fullPath);
                }
            } else if (entry.name.endsWith('.js.map') || entry.name.endsWith('.map')) {
                try {
                    fs.unlinkSync(fullPath);
                } catch (_) { }
            } else if (entry.name.endsWith('.js')) {
                try {
                    const originalContent: string = fs.readFileSync(fullPath, 'utf8');
                    const cleanedContent: string = this.cleanCompiledFile(originalContent);
                    if (cleanedContent !== originalContent) {
                        fs.writeFileSync(fullPath, cleanedContent);
                    }
                } catch (_) { }
            }
        }
    }

    /**
     * Clean single compiled JavaScript file contents.
     *
     * @param code - Raw compiled JavaScript content.
     * @returns Cleaned JavaScript content.
     */
    public cleanCompiledFile(code: string): string {
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

        const reserved: Set<string> = new Set([
            'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete',
            'do', 'else', 'export', 'extends', 'finally', 'for', 'function', 'if', 'import', 'in',
            'instanceof', 'new', 'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
            'var', 'void', 'while', 'with', 'yield'
        ]);

        // 4. Transform (0, helper.fn)(...) to fn(...) with destructuring
        const importUsages: Map<string, Set<string>> = new Map();
        const callRegex: RegExp = /\(0,\s*([a-zA-Z0-9_$]+)\.([a-zA-Z0-9_$]+)\)\(/g;
        let m: RegExpExecArray | null;
        while ((m = callRegex.exec(code)) !== null) {
            const varName: string = m[1];
            const fnName: string = m[2];
            if (!importUsages.has(varName)) {
                importUsages.set(varName, new Set());
            }
            importUsages.get(varName)!.add(fnName);
        }

        for (const [varName, fns] of importUsages.entries()) {
            const reqRegex: RegExp = new RegExp(`const\\s+${varName}\\s*=\\s*require\\(([^)]+)\\);?`);
            if (reqRegex.test(code)) {
                const fnList: string = Array.from(fns).join(', ');
                code = code.replace(reqRegex, (_m: string, p1: string): string => `const { ${fnList} } = require(${p1});`);
                for (const fn of fns) {
                    const replaceCall: RegExp = new RegExp(`\\(0,\\s*${varName}\\.${fn}\\)\\(`, 'g');
                    code = code.replace(replaceCall, `${fn}(`);
                }
            }
        }

        // Fallback for any remaining (0, obj.fn)(...)
        code = code.replace(/\(0,\s*([a-zA-Z0-9_$]+)\.([a-zA-Z0-9_$]+)\)\(/g, (_m: string, obj: string, method: string): string => {
            if (obj.endsWith('Helper')) {
                return `${method}(`;
            }
            return `${obj}.${method}(`;
        });

        // 5. Map remaining _1, _2 back to actual identifiers without _interop
        const varMap: Map<string, string> = new Map();
        const requiredVars: Set<string> = new Set();
        const requireRegex: RegExp = /const\s+([a-zA-Z0-9_$]+)_(\d+)\s*=\s*require\((["'][^"']+["'])\);?/g;
        let match: RegExpExecArray | null;
        while ((match = requireRegex.exec(code)) !== null) {
            const fullVar: string = `${match[1]}_${match[2]}`;
            const baseName: string = match[1];
            const num: string = match[2];
            let cleanName: string = num === '1' ? baseName : `${baseName}${num}`;
            if (reserved.has(cleanName)) {
                cleanName = `${cleanName}Helper`;
            }
            varMap.set(fullVar, cleanName);
            requiredVars.add(cleanName);
        }

        const singleRequireRegex: RegExp = /const\s+([a-zA-Z0-9_$]+)\s*=\s*require\((["'][^"']+["'])\);?/g;
        while ((match = singleRequireRegex.exec(code)) !== null) {
            if (!match[1].includes('_')) {
                requiredVars.add(match[1]);
            }
        }

        for (const [oldVar, newVar] of varMap.entries()) {
            const declRegex: RegExp = new RegExp(`const\\s+${oldVar}\\s*=\\s*require\\(([^)]+)\\);?`, 'g');
            code = code.replace(declRegex, `const ${newVar} = require($1);`);
            const usageRegex: RegExp = new RegExp(`\\b${oldVar}\\b`, 'g');
            code = code.replace(usageRegex, newVar);
        }

        // 6. Remove .default property accessors everywhere on imported variables
        for (const v of requiredVars) {
            const defaultPropRegex: RegExp = new RegExp(`\\b${v}\\.default\\b`, 'g');
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
    public removeTypeScriptArtifacts(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath: string = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (entry.name !== 'node_modules' && entry.name !== '.git') {
                    this.removeTypeScriptArtifacts(fullPath);
                }
            } else if (
                entry.name.endsWith('.ts') ||
                entry.name.endsWith('.d.ts') ||
                entry.name.endsWith('.d.ts.map') ||
                entry.name.endsWith('.map') ||
                entry.name === 'tsconfig.json' ||
                entry.name === 'tsconfig.build.json'
            ) {
                try {
                    fs.unlinkSync(fullPath);
                } catch (_) { }
            }
        }
    }

    /**
     * Update package.json to reflect pure JavaScript configuration.
     *
     * @param directory - Application root directory path.
     */
    public updatePackageJsonForJavaScript(directory: string): void {
        const pkgPath: string = path.join(directory, 'package.json');
        if (!fs.existsSync(pkgPath)) return;
        const pkg: any = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.main = 'app.js';
        delete pkg.types;
        if (pkg.scripts) {
            delete pkg.scripts.build;
            delete pkg.scripts['build:clean'];
            delete pkg.scripts.start;
            delete pkg.scripts.server;
            delete pkg.scripts['start:prod'];
            pkg.scripts['server:start'] = 'node app.js';
        }
        if (pkg.devDependencies) {
            delete pkg.devDependencies.typescript;
            delete pkg.devDependencies['@types/node'];
            delete pkg.devDependencies['ts-node'];
            delete pkg.devDependencies.tsx;
        }
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    }

    /**
     * Fix bin symlinks created by npm in node_modules/.bin so they don't point to the temporary directory.
     *
     * @param directory - Application root directory path.
     * @param tempWorkingDir - Temporary directory path where npm install ran.
     */
    public fixBinSymlinks(directory: string, tempWorkingDir: string): void {
        const binDir: string = path.join(directory, 'node_modules', '.bin');
        if (!fs.existsSync(binDir)) return;
        const normalizedTemp: string = tempWorkingDir.replace(/^\/private/, '');
        const entries = fs.readdirSync(binDir);
        for (const entry of entries) {
            const symlinkPath: string = path.join(binDir, entry);
            try {
                const stat = fs.lstatSync(symlinkPath);
                if (stat.isSymbolicLink()) {
                    const target: string = fs.readlinkSync(symlinkPath);
                    const normalizedTarget: string = target.replace(/^\/private/, '');
                    if (path.isAbsolute(target) && (target.startsWith(tempWorkingDir) || normalizedTarget.startsWith(normalizedTemp))) {
                        const relPart: string = normalizedTarget.substring(normalizedTemp.length).replace(/^[/\\]+/, '');
                        const newTarget: string = path.join(directory, relPart);
                        fs.unlinkSync(symlinkPath);
                        fs.symlinkSync(newTarget, symlinkPath);
                    }
                }
            } catch (_) { }
        }
    }
}

Object.defineProperty(NewCommand, '__esModule', { value: true });
(NewCommand as any).default = NewCommand;

export default NewCommand;
