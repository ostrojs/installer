#!/usr/bin/env node

/**
 * @file Index entry point for @ostro/installer CLI binary.
 * @module @ostro/installer
 */

import ConsoleApplication from '@ostro/console';
import { program } from 'commander';
import NewCommand from './newCommand';
import AssistantCommand from './assistantCommand';

/**
 * Initialize the Ostro Console Application instance.
 */
const $app: ConsoleApplication = new ConsoleApplication();

/**
 * Register available CLI commands.
 */
$app.add(new NewCommand());

const assistantCmd = new AssistantCommand();
$app.add(assistantCmd);

// Allow arbitrary subcommands and options forwarded to local project assistant
const cmd = program.commands.find((c: any): boolean => c.name() === 'assistant');
if (cmd) {
    cmd.allowUnknownOption();
}

/**
 * Parse CLI arguments and execute the matching command.
 * Exits with status code 0 on success, or status code 1 on error.
 */
$app.run(process.argv.slice(2))
    .then((): void => {
        process.exit(0);
    })
    .catch((err: unknown): void => {
        console.error(err);
        process.exit(1);
    });

export default $app;
