#!/usr/bin/env node

/**
 * @file Index entry point for @ostro/installer CLI binary.
 * @module @ostro/installer
 */

import ConsoleApplication from '@ostro/console';
import NewCommand from './newCommand';

/**
 * Initialize the Ostro Console Application instance.
 */
const $app: ConsoleApplication = new ConsoleApplication();

/**
 * Register available CLI commands.
 */
$app.add(new NewCommand());

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
