import { createApp, h } from 'vue'
import Layout from '@/components/layout.vue'
import SettingsPage from '@/components/pages/settings-page.vue'
import Titlebar from '@/components/titlebar.vue'
import '@/styles/global.css'

const app = createApp({
  render() {
    return h('div', { class: 'h-full flex flex-col' }, [
      h(Titlebar),
      h(Layout, { currentPage: 'settings' }, () => h(SettingsPage)),
    ])
  },
})

app.mount('#app')
