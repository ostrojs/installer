const Command = require('@ostro/console/command')
const child_process = require('child_process')
var readline = require('readline')
const fs = require('fs')
const os = require('os')
class NewCommand extends Command {

    $signature = 'new';


    $description = 'Create a new OstroJS application';


    $options = [
        this.createOption('--dev', 'Installs the latest "development" release'),
        this.createOption('--force', 'Forces install even if the directory already exists').default(false)
    ]

    $arguments = [
        this.createArgument('name', 'The name of the application').required()
    ]

    handle() {

        this.output.writeln(`<fg=cyan> 
                ___
              /     \\
             /       \\_____ \_____ ______ \_\__
            |        / ___\|   \|   | \'__/  _  \\
            |        \\___ \\   |   | | \|  (_)  \|
             \\       /____\/   |   | |  \\ ___ \/
              \\ ___ /                     
            
             
         </>`);

        let $name = this.input.getArgument('name');

        let $directory = $name !== '.' ? process.cwd() + path.sep + $name : '.';

        let $version = this.getVersion(this.input);
        if (!this.input.getOption('force')) {
            this.verifyApplicationDoesntExist($directory);
        }

        if (this.input.getOption('force') && $directory === '.') {
            throw new RuntimeException('Cannot use --force option when using current directory for installation!');
        }

          let $currentVersion = this.runCommands(['npm show @ostro/installer version'])

        let $existingVersion = this.runCommands([`npm ls @ostro/installer -g version --depth=0`]);
        $existingVersion = ($existingVersion || "").replace(/[\s\S]*?@ostro\/installer@/gi,'');
        
        this.output.write('[1/7] ')
        let versionMessage = $existingVersion == $currentVersion ? '@ostro/installer version verified' : `Update require "npm install @ostro/installer@latest -g"`
        this.error(versionMessage)

        let osType = os.type()
        if ($directory != '.' && this.input.getOption('force')) {
            try {
                fs.rmdirSync($directory, { force: true, recursive: true })
            } catch (e) {
                this.error(e)
            }
        }
        fs.mkdirSync($directory)

        this.output.write('[2/7] ')
        this.info('Directory created')

        let $url = this.runCommands(['npm v @ostro/ostro dist.tarball'])
        let $commands = [
            `cd ${$directory}`,
            `curl -s "${$url.trim()}" | tar -xzf - --strip 1`,
        ];
        if (osType != 'Windows_NT') {
            $commands.push(`chmod 755 "${$directory}/assistant"`);
        }

        this.runCommands($commands)
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0, null)
        this.output.write('[3/7] ')
        this.info('Application crafted')

        fs.copyFileSync($directory + path.sep + '.env.example', $directory + path.sep + '.env')
        this.output.write('[4/7] ')
        this.info('Environment file generated')

        this.runCommands([`cd ${$directory} && npm install`])
        this.output.write('[5/7] ')
        this.info('Dependencies installed')

        this.runCommands([`cd ${$directory} && node assistant key:generate`])
        this.output.write('[6/7] ')
        this.info('Key generated')

        if ($name !== '.') {
            this.replaceInFile(
                'APP_URL=http://localhost',
                'APP_URL=http://' + $name + '.test',
                $directory + path.sep + '.env'
            );

            this.replaceInFile(
                'DB_DATABASE=ostro',
                'DB_DATABASE=' + $name.toLowerCase().replace('-', '_'),
                $directory + path.sep + '.env'
            );

            this.replaceInFile(
                'DB_DATABASE=ostro',
                'DB_DATABASE=' + $name.toLowerCase().replace('-', '_'),
                $directory + path.sep + '.env.example'
            );
        }
        this.output.write('[7/7] ')
        this.info('Application setup compleated')
        process.stdout.write('\n\n')
        this.output.writeln('<comment>Application ready! Build something amazing.</comment>');
        process.stdout.write('\n')
        this.output.writeln('<fg=cyan>cd  ' + $name + '</fg>');
        this.output.writeln('<fg=cyan>node app.js</fg>');
    }

    verifyApplicationDoesntExist($directory) {
        try {
            let stat = fs.statSync($directory)
            if ((stat.isDirectory() || fs.isFile()) && $directory != process.cwd()) {
                this.error('Application already exists!')
                process.exit(1)
            }
        } catch (e) {

        }
    }

    runCommands($commands, $env = {}) {

        try {
            return (child_process.execSync($commands.join(' && '), { encoding: 'utf8' }));
        } catch (e) {}
    }

    getVersion($input) {
        if ($input.getOption('dev')) {
            return 'dev-master';
        }

        return '';
    }

    defaultBranch() {
        return 'develop'
    }
    replaceInFile($search, $replace, $file) {
        try {
            fs.writeFileSync(
                $file,
                fs.readFileSync($file, 'utf8').replace($search, $replace)
            );
        } catch (e) {

        }
    }
}

module.exports = NewCommand