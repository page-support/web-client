export default {
  "version": "1.0.0",
  "publisherId": "",
  "publisherName": "",
  "publisherPhone": "",
  "publisherLogoUrl": "",
  "publisherApiKeys": [],
  "frames": {
    "ac0a801706a9511ec9ed2e9de1f86b6ba": {
      "name": "cancel apple subscription",
      "introduction": "### About canceling a subscription\nSubscriptions drain your bank account, here's how to stop it from continuing\n- Most subscriptions automatically renew unless you cancel them.\n- If you cancel, you can keep using the subscription until the next billing date.\n- If you cancel during a trial period, you might lose access to content immediately.",
      "localeString": "en-US",
      "phrasings": [
        "how to cancel a subscription",
        "where do I stop a subscription"
      ],
      "slots": [
        {
          "name": "device",
          "type": "single",
          "ask": "What type of device are you on?",
          "replyId": "deviceType",
          "trigger": "true"
        },
        {
          "name": "ac0a801716a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "### How to see or cancel subscriptions on your iPhone, iPad, or iPod touch\nThese steps take place on your device.\n1. Open the Settings app.",
          "replyId": "done",
          "trigger": "same('device', [2])"
        },
        {
          "name": "ac0a801726a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "2. Tap your name.",
          "replyId": "done",
          "trigger": "same('ac0a801716a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "ac0a801736a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "3. Tap Subscriptions. (If you don't see \"Subscriptions,\" tap \"iTunes & App Store\" instead. Then tap your Apple ID, tap View Apple ID, sign in, scroll down to Subscriptions, and tap Subscriptions.)",
          "replyId": "done",
          "trigger": "same('ac0a801726a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "ac0a801746a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "4. Tap the subscription that you want to manage. Don't see the subscription that you're looking for?",
          "replyId": "done",
          "trigger": "same('ac0a801736a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "ac0a801756a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "5. [Tap Cancel Subscription](https://example.com) If you don’t see Cancel Subscription, the subscription is already canceled and won't renew.",
          "replyId": "done",
          "trigger": "same('ac0a801746a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "ac0a801766a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "### See or cancel subscriptions on your Mac\n1. Open the App Store app.",
          "replyId": "done",
          "trigger": "same('device',[0])"
        },
        {
          "name": "ac0a801776a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "2. Click the sign-in button or your name at the bottom of the sidebar.\nSee below for where the sign-in button is located \n![sign in button](https://pagesupport.s3.us-west-2.amazonaws.com/jupiter.jpg)",
          "replyId": "done",
          "trigger": "same('ac0a801766a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "ac0a828806a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "1. Open the Apple TV on your TV.",
          "replyId": "done",
          "trigger": "same('device',[1])"
        },
        {
          "name": "ac0a828816a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "2. Click the sign-in button or your name at the bottom of the sidebar.",
          "replyId": "done",
          "trigger": "same('ac0a828806a9511ec9ed2e9de1f86b6ba', [0])"
        },
        {
          "name": "ac0a828826a9511ec9ed2e9de1f86b6ba",
          "type": "diagnostic",
          "ask": "3. Stand upside down and while jumping right and left, say a magic incantation.",
          "replyId": "done",
          "trigger": "same('ac0a828816a9511ec9ed2e9de1f86b6ba', [0])"
        }
      ]
    }
  },
  "startFrameId": "ac0a801706a9511ec9ed2e9de1f86b6ba",
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
    "deviceType": [
      "Mac",
      "AppleTV",
      "iPhone, iPad, or iPod touch"
    ]
  },
  "clients": {},
  "botSettings": {
    "primaryColor": "#38bdf8",
    "secondaryColor": "#e0f2fe",
    "hoverColor": "#0ea5e9",
    "containerBg": "#F9FAFB",
    "containerBorderBg": "#f0f9ff",
    "trackUserReplies": true,
    "customerFont": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
  },
  "appState": {
    "currentFrameSlotIndex": 0
  }
};