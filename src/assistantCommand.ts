import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
import Command from '@ostro/console/command';

interface AssistantCommand {
    input: {
        getOption(name?: string): any;
        getArgument(name?: string): any;
    };
    output: {
        write(message: string): void;
        writeln(message: string): void;
    };
    info(message: string): void;
    error(message: unknown): void;
}

/**
 * Console command to run the OstroJS Assistant CLI.
 * Delegates commands to the local project assistant script.
 */
class AssistantCommand extends Command {

    /**
     * The console command signature.
     */
    public get $signature(): string {
        return 'assistant';
    }

    /**
     * The console command description.
     */
    public get $description(): string {
        return 'Run application assistant commands';
    }

    /**
     * The console command options definition.
     */
    public get $options(): any[] {
        return [
            this.createOption('-f, --file <path>', 'Custom path to assistant file')
        ];
    }

    /**
     * The console command arguments definition.
     */
    public get $arguments(): any[] {
        return [
            this.createArgument('[commands...]', 'Assistant command and arguments')
        ];
    }

    /**
     * Resolve the target assistant file path.
     *
     * @param cwd - Current working directory.
     * @param customPath - Optional custom file passed via --file.
     * @returns Absolute path to assistant file.
     */
    public resolveAssistantPath(cwd: string, customPath?: string): string {
        if (customPath && customPath.trim().length > 0) {
            const trimmed = customPath.trim();
            return path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed);
        }
        return path.resolve(cwd, 'assistant');
    }

    /**
     * Resolve the arguments to forward to the assistant process.
     *
     * @param commanderArgs - Arguments parsed by commander or fallback array.
     * @returns Forwarded arguments array.
     */
    public getForwardedArgs(commanderArgs?: string[]): string[] {
        if (Array.isArray(commanderArgs) && commanderArgs.length > 0) {
            return [...commanderArgs];
        }

        // Fallback: extract args from process.argv
        const argv: string[] = process.argv.slice(2);
        const assistantIdx: number = argv.indexOf('assistant');
        if (assistantIdx === -1) {
            return [];
        }

        const remaining: string[] = argv.slice(assistantIdx + 1);
        const forwarded: string[] = [];
        for (let i = 0; i < remaining.length; i++) {
            const arg = remaining[i];
            if (arg === '-f' || arg === '--file') {
                i++; // Skip option value
            } else if (arg.startsWith('--file=')) {
                // Skip combined flag
            } else {
                forwarded.push(arg);
            }
        }
        return forwarded;
    }

    /**
     * Execute the assistant process synchronously with piped stdio.
     *
     * @param assistantFile - Target assistant file to execute.
     * @param args - Arguments to pass to the assistant file.
     * @param cwd - Working directory for the process.
     * @returns Exit code of the child process.
     */
    public executeAssistant(assistantFile: string, args: string[], cwd: string = process.cwd()): number {
        const result = child_process.spawnSync(process.execPath, [assistantFile, ...args], {
            cwd,
            stdio: 'inherit'
        });
        return result.status ?? (result.error ? 1 : 0);
    }

    /**
     * Execute the console command.
     */
    public async handle(): Promise<void> {
        const cwd: string = process.cwd();
        const customFile: string | undefined = this.input.getOption('file');
        const assistantPath: string = this.resolveAssistantPath(cwd, customFile);

        if (!fs.existsSync(assistantPath)) {
            this.error(`Assistant file not found: ${assistantPath}`);
            process.exit(1);
            return;
        }

        // Retrieve commander parsed command args or fallback
        const commanderCmd = this.$console?.commands?.find?.((c: any) => c.name?.() === 'assistant')
            || (this as any).commanderCommand;
        const rawArgs = commanderCmd?.args;
        const forwardedArgs: string[] = this.getForwardedArgs(rawArgs);

        const exitCode = this.executeAssistant(assistantPath, forwardedArgs, cwd);
        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    }
}

export default AssistantCommand;
