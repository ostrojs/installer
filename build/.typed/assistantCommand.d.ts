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
declare class AssistantCommand extends Command {
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
     * Resolve the target assistant file path.
     *
     * @param cwd - Current working directory.
     * @param customPath - Optional custom file passed via --file.
     * @returns Absolute path to assistant file.
     */
    resolveAssistantPath(cwd: string, customPath?: string): string;
    /**
     * Resolve the arguments to forward to the assistant process.
     *
     * @param commanderArgs - Arguments parsed by commander or fallback array.
     * @returns Forwarded arguments array.
     */
    getForwardedArgs(commanderArgs?: string[]): string[];
    /**
     * Execute the assistant process synchronously with piped stdio.
     *
     * @param assistantFile - Target assistant file to execute.
     * @param args - Arguments to pass to the assistant file.
     * @param cwd - Working directory for the process.
     * @returns Exit code of the child process.
     */
    executeAssistant(assistantFile: string, args: string[], cwd?: string): number;
    /**
     * Execute the console command.
     */
    handle(): Promise<void>;
}
export default AssistantCommand;
//# sourceMappingURL=assistantCommand.d.ts.map