## Why page.support?

Page.support is a solution for automating customer support. Page.support lets you quickly create chatbots and workflow-enabled websites without writing code. It does this by emulating the primitives that underly human conversation, reducing the amount of work required to design conversations. Rapid iteration based on customer feedback is essential to the adoption of automation, making a no-code solution important - particularly if the support team does not have dedicated software developers. The [Page.support publisher](https://publisher.page.support) lets you define the user interaction by writing markdown with some additional annotations to define the workflow. For more on why page.support was built and the benefits for customers support see our [manifesto](link to github pages or the ghost site)

The Bot client software in this repository and the interface between the client and publisher is MIT licensed open source, providing use case flexibility and reducing dependence on a single vendor. The open source [botConfig](https://github.com/page-support/bot/src/state/botConfig.js) interface between publisher and client lets an ecosystem of SaaS providers, developers and users interoperate. 

Since the page.support bot runs in the user's browser, you can create experiences with a high degree of responsiveness, availability, privacy and security that don't depend on a third party chatbot server. If needed, user data can be read/written to servers you select to save user replies or personalize the experience. However the Bot's basic functionality - dialog, questions, and taking user replies - doesn't need a server to run. This lets you design experiences that protect user privacy and meet regulatory requirements by minimizing data that goes back to servers, particularly third party servers.

## Page.Support Bot 

This repository contains the open source Bot client component to embed in your website. The Bot client is a javascript component that drives the end user experience. It runs in the user's browser without any server side connection required after the initial page load. Its behavior is customized by a botConfig.js file that is generated by a publisher like the one at publisher.page.support. The configuration file enables the behaviors described in the [documentation](https://page.support/documentation) The src/interface directory in this repository contains the botConfig JSON template that defines the interface between Page.Support publishers and all Bot clients such as this one. This bot client includes basic color and font customization. If you need more customization, fork this repository and customize the Bot client to add functionality or change its look and feel. If your enhancements are generally useful we appreciate your contributions via pull requests. As long as your Bot clients maintain compatibility with the botConfig definition, your customized/forked client can be used with any Page.Support compliant publisher.

If your bot requires reading or writing data from a server, e.g. for authentication, personalization, or saving user replies, see the Server Integration section below.


## Adding Bot to your website

There are several ways to integrate Bot into your website. In all cases, Bot needs three files to function and potentially other files like images:

* The Bot javascript component in this repository. You can fork this repo or install the component with `npm install page-support-bot`
* A configuration file that defines the bot's behavior. This file will be produced by a publisher like the one at publisher.page.support. Click the download button to get a ES6 module version of the file. In the future this will be loaded from publisher.page.support so the behavior of your bot doesn't require pushing a code release.
* A [page-support-bot-bundle.css](https://github.com/page-support/bot/dist/page-support-bot-bundle.css) file. 
* If you botConfig includes references to images, you'll need to host them on an server at whatever URLs you used in your markdown.

### Add Bot to your javascript build pipeline

 If your already have a build pipeline for your js code, you can add Bot as a dependency via npm, import it into your javascript application, then build and deploy it with the rest of your site. You will also need to add static assets your Bot uses to an asset server you maintain.  

```
npm install page-support-bot
```

Now add it to your package.json under "dependencies"

```
"page-support-bot": "1.0.0"
```

Import into your javascript application

```
// The Bot client code, installed from npm
import Bot from "page-support-bot"; 

// Your Bot's configuration file that defines its behavior. Download it from  
// publisher.page.support and save to your application's repository if you want 
// it under version control (encouraged), or load from static file server if not. 
import botConfig from "/your-path/to/page.support.botconfig.js"
```

Bot imports the stylesheet it needs from the node_modules directory it was 
installed into: `page-support-bot/dist/page-support-bot-bundle.css`. 
That css file is imported via an @import command in the <style> section of Bot.svelte. 
Your bundler should compile that file along with the rest of your site's css 
into one file so no <link> to that file is needed.

In your HTML we can now add the Bot component

```
<Bot propBotConfig={botConfig} 
     bind:this={botBinding} 
     localStorageKey={localStorageKey} 
/> 
```

Bot supports the following props:

* botConfig is the js object imported earlier in your app. Its optional if you are using startNewConversation(botConfig) to initiate Bot. Otherwise required.
* bind:this={botBinding} is an optional reference to this bot that lets you call functions in the Bot, such as starting a new conversation. If you are not calling startNewConversation() or some other function exported by Bot its not needed. 
* propGetConfigFromRemote is a optional boolean that is not currently supported - in the future this will let you specify a remote URL from which load the bot definition.
* localStorageKey is the unique key Bot will use to preserve each user's conversation state in the browser. This should be a String unique to each bot in your domain. You can have multiple Bots per domain as long as they have unique keys. This prop is required.
* waitForStartNewConversation is an optional Boolean that defaults to false. If set to true, it tells this component to display nothing until startNewConversation() is called. This allows <Bot> to be added to the DOM without rendering anything. Its binding will be available, which lets the containing site call startNewConversation.

The bot component uses the Svelte javascript framework and tailwindcss framework. See the rollup.config.js, tailwind.config.js, babel.config.js and postcss.config.js files for build configuration requirements.


### Add Bot as an iife file to your HTML

If you don't have a js build pipeline, perhaps because your website is server side rendered, like a Rails app or third party web host, you can add Bot as an iife file. This scenario also requires you to host static assets like css files and images on a server or storage bucket you control.

Add the [page.support.min.js](https://github.com/page-support/bot/dist/page.support.min.js), [page-support-bot-bundle.css](https://github.com/page-support/bot/dist/page-support-bot-bundle.css), and page.support.botconfig.js files to the page where you want to your users to see the bot.

```
<script src="/page.support.min.js" ></script>
<link rel="stylesheet" type="text/css" href="/page-support-bot-bundle.css" />

<script type="module"> 

// Import your Bot client definition.
// 1. download the botconfig file from publisher.page.support 
// 2. save it to your application's repository if you want it under
// version control, or load from static file server if not
import botConfig from "/path/to/page.support.botconfig.js"

let bot;
document.addEventListener("DOMContentLoaded", function() {
    if (document.getElementById('bot')) {
      // PageSupportBot is the name of the var in the iife function 
      // Bot is the constructor it exports.   
      bot = new PageSupportBot.Bot({
        target: document.getElementById('bot'),
        props: {
          propBotConfig: botConfig,
          localStorageKey: 'botNumberOne'
        }
      });
    } 
})

</script>

<div id="bot"></div>

```


### Add static assets - images and css
Any static assets referred to in your bot's markdown, such as image tags, must be uploaded to the URLs you added to the markdown. At this time page.support doesn't maintain any static asset servers, so add static assets to your storage bucket or website public directory.  

Don't forget to add the [page-support-bot-bundle.css](https://github.com/page-support/bot/dist/page-support-bot-bundle.css) file in this repository to the public folder of your web server as described previously.


### Conversation initialization
When your user first loads the page, the Bot will display and start a new conversation by default. Bot will maintain conversation state across page reloads in a tab by using sessionStorage. Closing the tab will end the conversation. 

If you want to give your web application control over when the Bot displays, use your web framework's conditional loading/display - usually some type of if block.

If you want give your web application control over starting and restarting a conversation, use `botBinding.startNewConversation(botConfig);` to start a new conversation with the passed in configuration. It also lets you give the user control over when to engage with the bot instead of launching it by default.


### Testing
This component includes setup files to perform visual testing in [Storybook](https://storybook.js.org). See the /.storybook directory in this repository for Storybook setup, and the ui/Bot.stories.js file for user stories and their test files. Since Bot is a component rather than a fully functioning website, Storybook provides an environment to test the component across different user stories without having to first do an integration with your website.

Install Storybook, then type `npm run storybook` when in this repository's parent directory then open Storybook at localhost:6006

For automated tests, this component uses Jest. To run automated tests of dialog.js and lower level functions, see tests under src/dialog/tests and follow the instructions in the test file. Tests are sparse now, feel free to submit more with pull requests.

### Customizing and Building
If you make modifications to the Bot then want to deploy the changes to your website, run `$ npm run build` which will drop three files in the /dist directory:

- index.mjs is an ES6 module file for importation into your build.   
- index.min.js is a IIFE file for websites that do not use a modern build

### Server integration and Data Persistence

By default Bot only relies on the botConfig to drive its behavior so doesn't need to talk to a server. However if you want to personalize Bot's behavior, for example by loading user data, we will be adding simple integrations with arbitrary URLs and APIs in the next release. Those integrations will also enable saving user replies to an API on your server. 

If you want to do this now, you can customize the bot to 
load user data. Call out to your server right before the loadUI() function in Bot.svelte. To save individual user replies see the saveReply() function in dialog.js. To save an updated version of the entire conversation after every user reply see 
saveConversation() in state.js. 

### Versioning and Compatibility
The bot client and the botConfig file it uses must be on the same major version. The version of the bot client is the same as the version in package.json, and there's a check in state.js's versionCompatible() that will surface a user-visible error if bot reads a botConfig that's not compatible. botConfig files also have a version property that is used to determine compatibility. If you are adding the bot client to your website with your own build pipeline,ensure that the botConfigVersion constant in state.js is set to the same major version as the botConfig files you plan to use with the client. (and of course make whatever updates to the code you need to maintain compatibility) If you are adding bot client by copying in the index.min.js file the version will already be set by the rollup build process.