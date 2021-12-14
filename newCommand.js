const Command = require('@ostro/console/command')
const child_process = require('child_process')
const readline = require('readline')
const fs = require('fs')
const os = require('os')
const path = require('path')
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
            throw new Error('Cannot use --force option when using current directory for installation!');
        }
        
        this.output.write('[1/7] @ostro/installer Updating ...')
        this.runCommands([`npm update -g @ostro/installer --silent`])
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0, null)
        this.output.write('[1/7] ')
        this.info('@ostro/installer Updated')
        
        this.output.write('[2/7] Creating Directory ...')
        let osType = os.type()
        if ($directory != '.' && this.input.getOption('force')) {
            try {
                fs.rmdirSync($directory, { force: true, recursive: true })
            } catch (e) {
                this.error(e)
            }
        }
        fs.mkdirSync($directory)
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0, null)
        this.output.write('[2/7] ')
        this.info('Directory created')
        
        this.output.write('[3/7] Application Crafting ...')
        let $url = this.runCommands(['npm v @ostro/ostro dist.tarball'])
        let $commands = [
            `cd ${$directory}`,
            `curl -s "${$url.trim()}" | tar -xzf - --strip 1`,
        ];
        if (osType != 'Windows_NT') {
            $commands.push(`chmod 755 "${$directory}/assistant"`);
        }

        this.runCommands($commands)
        let packageJson = require($directory+path.sep+'package.json')
        let freshPackageJson = {}
        let requireKey = [['name',$name.split('/').pop()],'version',['private',true],'scripts','dependencies','devDependencies',]
        for(let key of requireKey){
            if(typeof key == 'string'){
                freshPackageJson[key] = packageJson[key] 
            }else{
                freshPackageJson[key[0]] = key[1]
            }
        }

        fs.writeFileSync($directory+path.sep+'package.json',JSON.stringify(freshPackageJson,undefined, 2))
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0, null)
        this.output.write('[3/7] ')
        this.info('Application crafted')

        fs.copyFileSync($directory + path.sep + '.env.example', $directory + path.sep + '.env')
        this.output.write('[4/7] ')
        this.info('Environment file generated')
       
        this.output.write('[5/7] Installing Dependencies ...')
        this.runCommands([`cd ${$directory} && npm install --silent`])
         readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0, null)
        this.output.write('[5/7] ')
        if(fs.existsSync(path.join($directory,'node_modules'))){
            this.info('Dependencies installed')
        }else{
            this.error('Unable to install Dependencies.')
        }

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