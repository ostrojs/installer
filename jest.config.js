module.exports = {
    testEnvironment: "node",
    testMatch: ["**/test/**/*.test.js"],
    transform: {},
    moduleNameMapper: {
        "^@ostro/support/(.*)$": "<rootDir>/../support/$1",
        "^@ostro/support$": "<rootDir>/../support",
        "^@ostro/console/(.*)$": "<rootDir>/../console/$1",
        "^@ostro/console$": "<rootDir>/../console"
    },
    collectCoverage: true,
    coverageDirectory: "coverage",
    coverageReporters: ["text", "lcov", "clover"],
    collectCoverageFrom: [
        "<rootDir>/**/*.js",
        "!<rootDir>/test/**",
        "!<rootDir>/coverage/**",
        "!<rootDir>/node_modules/**",
        "!<rootDir>/jest.config.js"
    ]
};
