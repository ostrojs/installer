"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_child_process_1 = __importDefault(require("node:child_process"));
const command_1 = __importDefault(require("@ostro/console/command"));
/**
 * Console command to run the OstroJS Assistant CLI.
 * Delegates commands to the local project assistant script.
 */
class AssistantCommand extends command_1.default {
    /**
     * The console command signature.
     */
    get $signature() {
        return 'assistant';
    }
    /**
     * The console command description.
     */
    get $description() {
        return 'Run application assistant commands';
    }
    /**
     * The console command options definition.
     */
    get $options() {
        return [
            this.createOption('-f, --file <path>', 'Custom path to assistant file')
        ];
    }
    /**
     * The console command arguments definition.
     */
    get $arguments() {
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
    resolveAssistantPath(cwd, customPath) {
        if (customPath && customPath.trim().length > 0) {
            const trimmed = customPath.trim();
            return node_path_1.default.isAbsolute(trimmed) ? trimmed : node_path_1.default.resolve(cwd, trimmed);
        }
        return node_path_1.default.resolve(cwd, 'assistant');
    }
    /**
     * Resolve the arguments to forward to the assistant process.
     *
     * @param commanderArgs - Arguments parsed by commander or fallback array.
     * @returns Forwarded arguments array.
     */
    getForwardedArgs(commanderArgs) {
        if (Array.isArray(commanderArgs) && commanderArgs.length > 0) {
            return [...commanderArgs];
        }
        // Fallback: extract args from process.argv
        const argv = process.argv.slice(2);
        const assistantIdx = argv.indexOf('assistant');
        if (assistantIdx === -1) {
            return [];
        }
        const remaining = argv.slice(assistantIdx + 1);
        const forwarded = [];
        for (let i = 0; i < remaining.length; i++) {
            const arg = remaining[i];
            if (arg === '-f' || arg === '--file') {
                i++; // Skip option value
            }
            else if (arg.startsWith('--file=')) {
                // Skip combined flag
            }
            else {
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
    executeAssistant(assistantFile, args, cwd = process.cwd()) {
        const result = node_child_process_1.default.spawnSync(process.execPath, [assistantFile, ...args], {
            cwd,
            stdio: 'inherit'
        });
        return result.status ?? (result.error ? 1 : 0);
    }
    /**
     * Execute the console command.
     */
    async handle() {
        const cwd = process.cwd();
        const customFile = this.input.getOption('file');
        const assistantPath = this.resolveAssistantPath(cwd, customFile);
        if (!node_fs_1.default.existsSync(assistantPath)) {
            this.error(`Assistant file not found: ${assistantPath}`);
            process.exit(1);
            return;
        }
        // Retrieve commander parsed command args or fallback
        const commanderCmd = this.$console?.commands?.find?.((c) => c.name?.() === 'assistant')
            || this.commanderCommand;
        const rawArgs = commanderCmd?.args;
        const forwardedArgs = this.getForwardedArgs(rawArgs);
        const exitCode = this.executeAssistant(assistantPath, forwardedArgs, cwd);
        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    }
}
exports.default = AssistantCommand;
//# sourceMappingURL=.typed/.maps/assistantCommand.js.map
if (exports.default) {
    const d = exports.default;
    module.exports = d;
    Object.assign(module.exports, exports);
    module.exports.default = d;
}
