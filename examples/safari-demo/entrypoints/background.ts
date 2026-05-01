export default defineBackground(() => {
  console.log('Safari demo background loaded', { id: browser.runtime.id })
})
