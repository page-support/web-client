1.0.0 / 2021-12-20
==================

### First submission to npm

2.0.0 / 2022-4-1
==================

### Breaking changes
* botCosmetics property in botConfig.js is now called botSettings and includes the new `trackUserReplies` property. It defaults to false, but when set to true, will call a global function  `pageSupportBotTracker()` and pass in data a website can then pass on to any engagement tracking service such as Google Analytics. See the documentation for version 2 for details on how to use it.

### Non breaking changes
* tailwindcss updated to v3
* several miss-installed dependencies moved out of production to dev dependencies
* many packages updated