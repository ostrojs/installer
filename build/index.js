#!/usr/bin/env node
"use strict";
/**
 * @file Index entry point for @ostro/installer CLI binary.
 * @module @ostro/installer
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const console_1 = __importDefault(require("@ostro/console"));
const commander_1 = require("commander");
const newCommand_1 = __importDefault(require("./newCommand"));
const assistantCommand_1 = __importDefault(require("./assistantCommand"));
/**
 * Initialize the Ostro Console Application instance.
 */
const $app = new console_1.default();
/**
 * Register available CLI commands.
 */
$app.add(new newCommand_1.default());
const assistantCmd = new assistantCommand_1.default();
$app.add(assistantCmd);
// Allow arbitrary subcommands and options forwarded to local project assistant
const cmd = commander_1.program.commands.find((c) => c.name() === 'assistant');
if (cmd) {
    cmd.allowUnknownOption();
}
/**
 * Parse CLI arguments and execute the matching command.
 * Exits with status code 0 on success, or status code 1 on error.
 */
$app.run(process.argv.slice(2))
    .then(() => {
    process.exit(0);
})
    .catch((err) => {
    console.error(err);
    process.exit(1);
});
exports.default = $app;
//# sourceMappingURL=.typed/.maps/index.js.map
if (exports.default) {
    const d = exports.default;
    module.exports = d;
    Object.assign(module.exports, exports);
    module.exports.default = d;
}
