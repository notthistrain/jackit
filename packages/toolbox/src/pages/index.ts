import { createApp, h } from 'vue'
import Layout from '@/components/layout.vue'
import ToolsPage from '@/components/pages/tools-page.vue'
import Titlebar from '@/components/titlebar.vue'
import UpdateDialog from '@/components/update-dialog.vue'
import '@/styles/global.css'

const app = createApp({
  render() {
    return h('div', { class: 'h-full flex flex-col' }, [
      h(Titlebar),
      h(Layout, { currentPage: 'tools' }, () => h(ToolsPage)),
      h(UpdateDialog),
    ])
  },
})

app.mount('#app')
