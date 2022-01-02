export default {
  "version": "1.0.0",
  "publisherId": "",
  "publisherName": "",
  "publisherPhone": "",
  "publisherLogoUrl": "",
  "publisherApiKeys": [],
  "frames": {
    "adac4de606a9111ec886b019ece025a82": {
      "name": "test triggers",
      "introduction": "# Lorem IpsumLorem IpsumLorem IpsumLorem IpsumLorem Ipsum",
      "localeString": "en-US",
      "phrasings": [
        "Lorem IpsumLorem Ipsum"
      ],
      "slots": [
        {
          "name": "AskOne",
          "type": "single",
          "ask": "Ask one",
          "replyId": "blahType",
          "trigger": "true"
        },
        {
          "name": "AskTwo",
          "type": "single",
          "ask": "Ask Two",
          "replyId": "productType",
          "trigger": "true"
        },
        {
          "name": "selectCountries",
          "type": "multiple",
          "ask": "Ask three",
          "replyId": "allOptions",
          "trigger": "true"
        },
        {
          "name": null,
          "type": "answer",
          "ask": "first answer",
          "replyId": "",
          "trigger": "same('AskOne',[0]) and same('AskTwo', [0]) and (share('selectCountries', [1]) and not (share('selectCountries', [2,3])))"
        },
        {
          "name": null,
          "type": "answer",
          "ask": "second to last answer",
          "replyId": "",
          "trigger": "(share('selectCountries', [2,3]) or same('AskOne', [1])) and same('AskTwo', [0])"
        },
        {
          "name": null,
          "type": "answer",
          "ask": "Last answer",
          "replyId": "",
          "trigger": "same('AskTwo', [1])"
        }
      ]
    }
  },
  "startFrameId": "adac4de606a9111ec886b019ece025a82",
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
    "blahType": [
      "blah 1",
      "blah 2"
    ],
    "productType": [
      "one",
      "two"
    ],
    "allOptions": [
      "option 1",
      "option 2",
      "option 3",
      "option 4"
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