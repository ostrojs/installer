const Command = require('@ostro/console/command');
const child_process = require('child_process');
const readline = require('readline');
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Command class for initializing a new OstroJS application across Linux, macOS, and Windows.
 *
 * @class NewCommand
 * @extends {Command}
 */
class NewCommand extends Command {

    /**
     * The console command signature.
     *
     * @type {string}
     */
    $signature = 'new';

    /**
     * The console command description.
     *
     * @type {string}
     */
    $description = 'Create a new OstroJS application';

    /**
     * The console command options definition.
     *
     * @type {Array<Object>}
     */
    $options = [
        this.createOption('--dev', 'Installs the latest "development" release'),
        this.createOption('--force', 'Forces install even if the directory already exists').default(false)
    ];

    /**
     * The console command arguments definition.
     *
     * @type {Array<Object>}
     */
    $arguments = [
        this.createArgument('name', 'The name of the application').required()
    ];

    /**
     * Execute the console command.
     *
     * @async
     * @returns {Promise<void>}
     */
    async handle() {
        let directoryCreated = false;
        let $directory = '.';
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

            let $name = this.input.getArgument('name');
            $directory = $name !== '.' ? path.resolve(process.cwd(), $name) : '.';

            if (!this.input.getOption('force')) {
                this.verifyApplicationDoesntExist($directory);
            }

            if (this.input.getOption('force') && $directory === '.') {
                throw new Error('Cannot use --force option when using current directory for installation!');
            }

            let $currentVersion = (this.runCommandsSync(['npm show @ostro/installer version']) || '').trim();
            let $existingVersion = (this.runCommandsSync(['npm ls @ostro/installer -g version --depth=0']) || '');
            $existingVersion = $existingVersion.replace(/[^@]*@ostro\/installer@([\d.]+)\s*/, '$1').trim();

            this.output.write('[1/7] ');
            let versionMessage = $existingVersion === $currentVersion
                ? '@ostro/installer version verified'
                : 'Update required: "npm install @ostro/installer@latest -g"';

            if ($existingVersion !== $currentVersion) {
                this.error(versionMessage);
            } else {
                this.info(versionMessage);
            }

            let osType = os.type();
            if ($directory !== '.' && this.input.getOption('force')) {
                try {
                    fs.rmSync($directory, { force: true, recursive: true });
                } catch (e) {
                    this.error(e);
                }
            }
            fs.mkdirSync($directory, { recursive: true });
            directoryCreated = true;

            this.output.write('[2/7] ');
            this.info('Directory created');

            let $url = this.runCommandsSync(['npm v @ostro/ostro dist.tarball']);
            let $commands = [];

            if (osType === 'Windows_NT') {
                $commands.push(
                    `powershell -Command "Invoke-WebRequest -Uri '${$url.trim()}' -OutFile 'ostro.tar.gz'"`,
                    `tar -xzf ostro.tar.gz --strip 1`,
                    `powershell -Command "Remove-Item -Force 'ostro.tar.gz'"`
                );
            } else {
                $commands.push(
                    `curl -s "${$url.trim()}" | tar -xzf - --strip 1`,
                    `chmod 755 "${path.join($directory, 'assistant')}"`
                );
            }

            this.startSpinner('[3/7]', 'Crafting application...');
            await this.runCommandsAsync($commands, { cwd: $directory });
            this.stopSpinnerAndClear();
            this.output.write('[3/7] ');
            this.info('Application crafted');

            fs.copyFileSync(path.join($directory, '.env.example'), path.join($directory, '.env'));
            this.output.write('[4/7] ');
            this.info('Environment file generated');

            // Real-time single-line npm install log cross-platform (Debian, Linux, macOS, Windows)
            this.updateSingleLine('[5/7]', 'Installing dependencies...');
            await this.runNpmInstallWithRealtimeLog($directory, '[5/7]');
            this.clearLine();
            this.output.write('[5/7] ');
            this.info('Dependencies installed');

            this.startSpinner('[6/7]', 'Generating application key...');
            await this.runCommandsAsync(['node assistant key:generate'], { cwd: $directory });
            this.stopSpinnerAndClear();
            this.output.write('[6/7] ');
            this.info('Key generated');

            if ($name !== '.') {
                const dbName = $name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                this.replaceInFile('APP_URL=http://localhost', 'APP_URL=http://' + $name + '.test', path.join($directory, '.env'));
                this.replaceInFile('DB_DATABASE=ostro', 'DB_DATABASE=' + dbName, path.join($directory, '.env'));
                this.replaceInFile('DB_DATABASE=ostro', 'DB_DATABASE=' + dbName, path.join($directory, '.env.example'));
            }

            this.output.write('[7/7] ');
            this.info('Application setup completed');
            process.stdout.write('\n\n');
            this.output.writeln('<comment>Application ready! Build something amazing.</comment>');
            process.stdout.write('\n');
            this.output.writeln('<fg=cyan>cd ' + $name + '</fg>');
            this.output.writeln('<fg=cyan>node app.js</fg>');
        } catch (error) {
            this.stopSpinnerAndClear();
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
     * @param {string} prefix - Step identifier (e.g. '[3/7]').
     * @param {string} label - Progress label message.
     * @returns {void}
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
     *
     * @returns {void}
     */
    stopSpinner() {
        if (this.spinnerTimer) {
            clearInterval(this.spinnerTimer);
            this.spinnerTimer = null;
        }
    }

    /**
     * Stop the active spinner and clear the current stdout terminal line.
     *
     * @returns {void}
     */
    stopSpinnerAndClear() {
        this.stopSpinner();
        this.clearLine();
    }

    /**
     * Update the current terminal line with a single line message.
     *
     * @param {string} prefix - Step label or prefix.
     * @param {string} text - Message text to display.
     * @returns {void}
     */
    updateSingleLine(prefix, text) {
        if (process.stdout.isTTY) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
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
     *
     * @returns {void}
     */
    clearLine() {
        if (process.stdout.isTTY) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
        }
    }

    /**
     * Run `npm install` asynchronously while streaming real-time output on a single line.
     * Uses system shell context and an active spinner to ensure non-blocking execution across OSes.
     *
     * @param {string} directory - Path to the target directory.
     * @param {string} prefix - Step label prefix.
     * @returns {Promise<void>}
     */
    runNpmInstallWithRealtimeLog(directory, prefix) {
        return new Promise((resolve, reject) => {
            const child = child_process.exec('npm install', { cwd: directory });
            const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
            let i = 0;
            let lastLogLine = 'Starting npm install...';

            const timer = setInterval(() => {
                const frame = frames[i++ % frames.length];
                this.updateSingleLine(prefix, `${frame} Installing... ${lastLogLine}`);
            }, 80);

            const handleOutput = (data) => {
                const lines = data.toString().split('\n').filter(line => line.trim());
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
                } else {
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
     * @param {Array<string>} commands - List of commands to execute sequentially.
     * @param {Object} [options={}] - Additional options for child_process.exec (e.g. { cwd }).
     * @returns {Promise<string>} Output from executed commands.
     */
    runCommandsAsync(commands, options = {}) {
        return new Promise((resolve, reject) => {
            const cmd = commands.join(' && ');
            child_process.exec(cmd, { encoding: 'utf8', ...options }, (error, stdout, stderr) => {
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
     * @param {Array<string>} commands - List of commands to execute.
     * @param {Object} [options={}] - Additional options for child_process.execSync.
     * @returns {string} Standard output from execution.
     */
    runCommandsSync(commands, options = {}) {
        return child_process.execSync(commands.join(' && '), { encoding: 'utf8', ...options });
    }

    /**
     * Verify whether the target application directory already exists.
     *
     * @param {string} $directory - Absolute target directory path.
     * @returns {void}
     */
    verifyApplicationDoesntExist($directory) {
        try {
            let stat = fs.statSync($directory);
            if ((stat.isDirectory() || stat.isFile()) && $directory !== process.cwd()) {
                this.error('Application already exists!');
                process.exit(1);
            }
        } catch (e) {
            // Path does not exist, which is expected
        }
    }

    /**
     * Replace occurrences of a substring inside a target file.
     *
     * @param {string} $search - String to search for.
     * @param {string} $replace - Replacement string.
     * @param {string} $file - Target file path.
     * @returns {void}
     */
    replaceInFile($search, $replace, $file) {
        fs.writeFileSync($file, fs.readFileSync($file, 'utf8').replace($search, $replace));
    }
}

module.exports = NewCommand;
