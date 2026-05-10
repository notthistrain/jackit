<script setup lang="ts">
import type { AnyExtension } from '@tiptap/core'
import Placeholder from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import { Markdown } from '@tiptap/markdown'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Strikethrough,
  Undo,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>(), {
  placeholder: '开始编写内容...',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [string]
}>()

const editor = useEditor({
  content: props.modelValue,
  editable: !props.disabled,
  extensions: [
    Markdown,
    TableKit.configure({
      table: {
        resizable: true,
      },
    }),
    StarterKit.configure({}) as AnyExtension,
    Placeholder.configure({
      placeholder: props.placeholder,
    }),
  ],
  onUpdate: ({ editor }) => {
    emit('update:modelValue', editor.getHTML())
  },
})

const canUndo = computed(() => editor.value?.can().undo() ?? false)
const canRedo = computed(() => editor.value?.can().redo() ?? false)

function toggleBold() {
  editor.value?.chain().focus().toggleBold().run()
}

function toggleItalic() {
  editor.value?.chain().focus().toggleItalic().run()
}

function toggleStrike() {
  editor.value?.chain().focus().toggleStrike().run()
}

function toggleCode() {
  editor.value?.chain().focus().toggleCode().run()
}

function toggleHeading(level: 1 | 2 | 3) {
  editor.value?.chain().focus().toggleHeading({ level }).run()
}

function toggleBulletList() {
  editor.value?.chain().focus().toggleBulletList().run()
}

function toggleOrderedList() {
  editor.value?.chain().focus().toggleOrderedList().run()
}

function toggleBlockquote() {
  editor.value?.chain().focus().toggleBlockquote().run()
}

function undo() {
  editor.value?.chain().focus().undo().run()
}

function redo() {
  editor.value?.chain().focus().redo().run()
}

function importMarkdown(markdown: string) {
  if (editor.value?.markdown) {
    const json = editor.value.markdown.parse(markdown)
    editor.value.commands.setContent(json)
  }
}

defineExpose({
  importMarkdown,
})
</script>

<template>
  <div class="border rounded-lg overflow-hidden">
    <div v-if="!disabled" class="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/50">
      <Button variant="ghost" size="sm" :disabled="!canUndo" @click="undo">
        <Undo class="w-4 h-4" />
      </Button>
      <Button variant="ghost" size="sm" :disabled="!canRedo" @click="redo">
        <Redo class="w-4 h-4" />
      </Button>

      <div class="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': editor?.isActive('bold') }"
        @click="toggleBold"
      >
        <Bold class="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': editor?.isActive('italic') }"
        @click="toggleItalic"
      >
        <Italic class="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': editor?.isActive('strike') }"
        @click="toggleStrike"
      >
        <Strikethrough class="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': editor?.isActive('code') }"
        @click="toggleCode"
      >
        <Code class="w-4 h-4" />
      </Button>

      <div class="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': editor?.isActive('heading', { level: 1 }) }"
        @click="toggleHeading(1)"
      >
        <Heading1 class="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': editor?.isActive('heading', { level: 2 }) }"
        @click="toggleHeading(2)"
      >
        <Heading2 class="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': editor?.isActive('heading', { level: 3 }) }"
        @click="toggleHeading(3)"
      >
        <Heading3 class="w-4 h-4" />
      </Button>

      <div class="w-px h-6 bg-border mx-1" />

      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': editor?.isActive('bulletList') }"
        @click="toggleBulletList"
      >
        <List class="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': editor?.isActive('orderedList') }"
        @click="toggleOrderedList"
      >
        <ListOrdered class="w-4 h-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        :class="{ 'bg-accent': editor?.isActive('blockquote') }"
        @click="toggleBlockquote"
      >
        <Quote class="w-4 h-4" />
      </Button>
    </div>

    <EditorContent
      :editor="editor"
      class="rich-text max-w-none p-4 min-h-[300px] focus:outline-none"
      :class="{ 'bg-muted/30 cursor-not-allowed': disabled }"
    />
  </div>
</template>

<style>
.tiptap {
  outline: none;
}

.tiptap p.is-editor-empty:first-child::before {
  color: var(--muted-foreground);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.tiptap table .selectedCell {
  background-color: rgba(59, 130, 246, 0.1);
}

.tiptap table .column-resize-handle {
  position: absolute;
  right: -2px;
  top: 0;
  bottom: 0;
  width: 4px;
  background-color: var(--primary);
  pointer-events: none;
}
</style>
