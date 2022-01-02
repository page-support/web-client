export default {
  "version": "1.0.0",
  "publisherId": "",
  "publisherName": "",
  "publisherPhone": "",
  "publisherLogoUrl": "",
  "publisherApiKeys": [],
  "frames": {
    "a700891106a6a11ec8d570546f573d716": {
      "name": "internet is down",
      "introduction": "",
      "localeString": "en-US",
      "phrasings": [
        "my router doesn't work",
        "my internet is down"
      ],
      "slots": [
        {
          "name": "device",
          "type": "single",
          "ask": "what type of device do you have?",
          "replyId": "deviceType",
          "trigger": "true"
        },
        {
          "name": "attempts",
          "type": "multiple",
          "ask": "Select which of the following solutions you have already tried.",
          "replyId": "allAttempts",
          "trigger": "same('device',[1])"
        },
        {
          "name": null,
          "type": "answer",
          "ask": "Your router may need to be upgraded, this router has a history of problems and doesn't support some new devices. We suggest one of the following routers - click the link to purchase:\n- [InternetCo Router WB45](http://www.example.com)\n- [InternetCo Router XY87](http://www.example.com) \n- [FancyWidgetCo Router WFFB45](http://www.example.com)",
          "replyId": "",
          "trigger": "same('device',[0])"
        },
        {
          "name": null,
          "type": "answer",
          "ask": "Your router is not connected to our servers. Try the following in this precise order:\n1. unplug your router's power\n2. unplug your router cable\n3. disconnect all devices\n4. do a handstand\n5. reconnect the power\n6. reconnect the cable\n7. reconect your devices",
          "replyId": "",
          "trigger": "same('device',[1]) and (subset('attempts', [0, 1, 2 ]))"
        },
        {
          "name": "giveUp",
          "type": "answer",
          "ask": "Please check our community forums for more information on what your problem might be.",
          "replyId": "",
          "trigger": "true"
        }
      ]
    }
  },
  "startFrameId": "a700891106a6a11ec8d570546f573d716",
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
      "model A1 router",
      "model B334 router"
    ],
    "allAttempts": [
      "Rebooted my computer",
      "Reconnected to WiFi",
      "Rebooted the router",
      "Reinstalled my OS",
      "Updated router firmware",
      "Checked that router power is on and cables are connected.",
      "Switched Wifi to 5G"
    ]
  },
  "clients": {},
  "botCosmetics": {
    "primaryColor": "#38bdf8",
    "secondaryColor": "#e0f2fe",
    "hoverColor": "#0ea5e9",
    "containerBg": "#F9FAFB",
    "containerBorderBg": "#f0f9ff",
    "customerFont": "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'"
  },
  "appState": {
    "currentFrameSlotIndex": 0
  }
};