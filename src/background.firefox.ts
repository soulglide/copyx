import browser from "webextension-polyfill";

globalThis.browser.action.onClicked.addListener(() => {
  globalThis.browser.tabs.create({ url: globalThis.browser.runtime.getURL('index.html') });
});