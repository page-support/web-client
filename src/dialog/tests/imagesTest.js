export default {
  "version": "2.0.0",
  "publisherId": "",
  "publisherName": "",
  "publisherPhone": "",
  "publisherLogoUrl": "",
  "publisherApiKeys": [],
  "frames": {
    "a948099906a9511ec9ed2e9de1f86b6ba": {
      "name": "roaming",
      "introduction": "![lifestyle shoe image](https://images.unsplash.com/photo-1519707574798-77140649cfe5?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1192&q=80)\n# Lets find the best walking shoe for you.\nThe best shoe for you depends on how you want to balance fashion, comfort, and price. We'll start by asking some questions about your preferences, then recommend some shoes.",
      "localeString": "en-US",
      "phrasings": [
        "I'd like to use my phone in mexico",
        "How do I use my phone internationally?"
      ],
      "slots": [
        {
          "name": "imageConfig",
          "type": "single",
          "ask": "What type of image config do you want to test?",
          "replyId": "configType",
          "trigger": "true"
        },
        {
          "name": null,
          "type": "answer",
          "ask": "![Paris lifestyle image](https://images.unsplash.com/photo-1518556991616-b220cd5df12e?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80)\n### Women's walking shoes\nHere are some recommendations for casual day hiking shoes based on your responses:\n- ![ City Tripper image](https://images.unsplash.com/photo-1511556532299-8f662fc26c06?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80)\n### [ Womens City Tripper](https://google.com)\nThis is a good looking shoe that your friends will be envious of. I know you want them to be envious, go ahead and admit it, then buy this shoe. No pressure. I know you want them to be envious, go ahead and admit it, then buy this shoe. No pressure.\n- ![ShoeCo Day Hiker image](https://images.unsplash.com/photo-1551107696-a4b0c5a0d9a2?ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&ixlib=rb-1.2.1&auto=format&fit=crop&w=1300&q=80)\n### [ShoeCo Women's Day Hiker](https://google.com)\nIf you want something more sporty, try this which will make you look like sporty spice. Who is that you ask? Well once upon a time in the deep cold of a London winter morning..",
          "replyId": "",
          "trigger": "same('imageConfig', [0])"
        },
        {
          "name": null,
          "type": "answer",
          "ask": "![Travel](https://pagesupport.s3.us-west-2.amazonaws.com/jupiter.jpg)\nStaying connected while traveling internationally keeps getting simpler. ProductName allows you to use your existing talk, messaging and data plan for as little as $5 per day, per line*. To sign up for ProductName, simply visit [MyCell.com](http://www.example.com/my-n/) and select “manage international services” or use the MyCell app on your phone to activate it before embarking on a trip. Once at your destination, you’ll receive a text message welcoming you to the country and reminding you of the service and the daily fee: $5 per 24 hours in Mexico and Canada or $10 per 24 hours in 130+ other countries*.",
          "replyId": "",
          "trigger": "same('imageConfig', [1])"
        },
        {
          "name": "oneImageInAskPropWithSelect",
          "type": "multiple",
          "ask": "What countries will you be visiting? ![Travel](https://pagesupport.s3.us-west-2.amazonaws.com/jupiter.jpg)",
          "replyId": "allCountries",
          "trigger": "same('imageConfig', [2])"
        },
        {
          "name": "OneImageInParagraph",
          "type": "multiple",
          "ask": "## Pricing\n![Product Pricing](https://pagesupport.s3.us-west-2.amazonaws.com/jupiter.jpg)\nWhat countries will you be visiting? See above for pricing.",
          "replyId": "allCountries",
          "trigger": "same('imageConfig', [3])"
        },
        {
          "name": "a94810ec06a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "### How to see or cancel subscriptions on your iPhone, iPad, or iPod touch ![iphone screen](https://pagesupport.s3.us-west-2.amazonaws.com/ios14-iphone-12-pro-settings-apple-id-subscriptions-on-tap.png)\n0. Open the Settings app.",
          "replyId": "done",
          "trigger": "same('imageConfig', [4])"
        },
        {
          "name": "a94810ec16a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "1. Tap your name.",
          "replyId": "done",
          "trigger": "same('a94810ec06a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "a94810ec26a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "2. Tap Subscriptions. (If you don't see \"Subscriptions,\" tap \"iTunes & App Store\" instead. Then tap your Apple ID, tap View Apple ID, sign in, scroll down to Subscriptions, and tap Subscriptions.)",
          "replyId": "done",
          "trigger": "same('a94810ec16a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "a94810ec36a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "3. Tap the subscription that you want to manage. Don't see the subscription that you're looking for?",
          "replyId": "done",
          "trigger": "same('a94810ec26a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "a94810ec46a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "4. [Tap Cancel Subscription](https://example.com) If you don’t see Cancel Subscription, the subscription is already canceled and won't renew.",
          "replyId": "done",
          "trigger": "same('a94810ec36a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "oneImageListAnswer",
          "type": "single",
          "ask": "- This paragraph describes how funky the [Womens City Tripper](https://google.com) shoe is. Funky town tonite lorem ipsum catpomipius maximus. Funky town tonite lorem ipsum catpomipius maximus.Funky town tonite lorem ipsum catpomipius maximus. Funky town tonite lorem ipsum catpomipius maximus. The image should render above text even though its below text in md. ![City Tripper image](https://pagesupport.s3.us-west-2.amazonaws.com/jupiter.jpg)",
          "replyId": "allCountries",
          "trigger": "same('imageConfig', [5])"
        },
        {
          "name": "twoImagesMiddleOfListItem",
          "type": "answer",
          "ask": "- **[Women's Day Hiker](https://google.com)**\nThis paragraph describes how funky this shoe is. Funky town tonite lorem ipsum catpomipius maximus. Funky town tonite lorem ipsum catpomipius maximus.Funky town tonite lorem ipsum catpomipius maximus. ![Day Hiker image](https://pagesupport.s3.us-west-2.amazonaws.com/jupiter.jpg) Funky town tonite lorem ipsum catpomipius maximus. Product link should show in bold and on another line from the rest of the paragraph\n- This paragraph describes how funky the [Womens City Tripper](https://google.com) shoe is. Funky town tonite lorem ipsum catpomipius maximus. Funky town tonite lorem ipsum catpomipius maximus.Funky town tonite lorem ipsum catpomipius maximus. Funky town tonite lorem ipsum catpomipius maximus. The image should render above text even though its below text in md. ![City Tripper image](https://pagesupport.s3.us-west-2.amazonaws.com/jupiter.jpg)",
          "replyId": "",
          "trigger": "same('imageConfig', [6])"
        },
        {
          "name": "a948135d06a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "# How to assemble your ikea cabinet\n0. Parts List ![Parts List](http://kitchencabinetslv.com/wp-content/uploads/2016/09/3-3-1024x757.jpg) Take all the parts out of the box and check if they are all there.",
          "replyId": "done",
          "trigger": "same('imageConfig', [7])"
        },
        {
          "name": "a948135d16a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "1. After you are done, it will look like this. ![finished](https://www.ikea.com/PIAimages/0449096_PE598623_S5.JPG) But you might not figure it out.",
          "replyId": "done",
          "trigger": "same('a948135d06a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "a948135d26a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "2. This step has no image.",
          "replyId": "done",
          "trigger": "same('a948135d16a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "noImages",
          "type": "answer",
          "ask": "# Reasons why you should quit your job\n0. You are not learning\n1. You are not having fun\n2. You are not getting rich",
          "replyId": "",
          "trigger": "same('imageConfig', [8])"
        }
      ]
    }
  },
  "startFrameId": "a948099906a9511ec9ed2e9de1f86b6ba",
  "replies": {
    "yes": [
      "yes",
      "no"
    ],
    "true": [
      "true",
      "false"
    ],
    "accept": [
      "accept",
      "reject"
    ],
    "done": [
      "done",
      "not done"
    ],
    "configType": [
      "Two images in list items in answer",
      "One image in answer no heading no list",
      "One image in say.ask with multiselect",
      "One image multiselect in md",
      "One image in diagnostic heading",
      "Image in list with single select after",
      "Two images in middle of two list items",
      "Diagnostic two images",
      "No images"
    ],
    "allCountries": [
      "Canada",
      "Mexico",
      "Uganda",
      "Europe"
    ]
  },
  "clients": {},
  "botSettings": {
    "primaryColor": "#38bdf8",
    "secondaryColor": "#e0f2fe",
    "hoverColor": "#0ea5e9",
    "containerBg": "#F9FAFB",
    "containerBorderBg": "#f0f9ff",
    "trackUserReplies": false,
    "customerFont": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
  },
  "appState": {
    "currentFrameSlotIndex": 0
  }
};