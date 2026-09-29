import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DocumentNotice from './DocumentNotice.vue'
import type { RecoveryDraft } from '../../stores/document'

const draft: RecoveryDraft = {
  key: 'abc',
  path: 'D:\\notes\\开题报告.md',
  content: '# 未保存的内容',
  savedAtMs: 1_758_000_000_000,
}

interface NoticeProps {
  recovery: RecoveryDraft | null
  conflict: string | null
}

function mountNotice(props: NoticeProps) {
  return mount(DocumentNotice, { props })
}

function buttonByText(wrapper: ReturnType<typeof mountNotice>, label: string) {
  return wrapper.findAll('button').find(button => button.text().includes(label))
}

describe('DocumentNotice', () => {
  it('renders nothing without a notice', () => {
    const wrapper = mountNotice({ recovery: null, conflict: null })

    expect(wrapper.find('.document-notice').exists()).toBe(false)
  })

  it('names the file a recovery draft belongs to', () => {
    const wrapper = mountNotice({ recovery: draft, conflict: null })

    expect(wrapper.text()).toContain('开题报告.md')
  })

  it('labels an untitled recovery draft', () => {
    const wrapper = mountNotice({ recovery: { ...draft, path: null }, conflict: null })

    expect(wrapper.text()).toContain('未命名文档')
  })

  it('emits recover or discard for a draft', async () => {
    const wrapper = mountNotice({ recovery: draft, conflict: null })

    await buttonByText(wrapper, '恢复')?.trigger('click')
    await buttonByText(wrapper, '丢弃')?.trigger('click')

    expect(wrapper.emitted('recover')).toHaveLength(1)
    expect(wrapper.emitted('discard')).toHaveLength(1)
  })

  it('offers overwrite, reload and save-as on conflict', async () => {
    const wrapper = mountNotice({ recovery: null, conflict: '文件已被其他程序修改。' })

    expect(wrapper.text()).toContain('文件已被其他程序修改')

    await buttonByText(wrapper, '覆盖保存')?.trigger('click')
    await buttonByText(wrapper, '重新载入')?.trigger('click')
    await buttonByText(wrapper, '另存为')?.trigger('click')

    expect(wrapper.emitted('overwrite')).toHaveLength(1)
    expect(wrapper.emitted('reload')).toHaveLength(1)
    expect(wrapper.emitted('saveAs')).toHaveLength(1)
  })

  it('lets the conflict prompt be dismissed', async () => {
    const wrapper = mountNotice({ recovery: null, conflict: '冲突' })

    await wrapper.find('.notice-dismiss').trigger('click')

    expect(wrapper.emitted('dismissConflict')).toHaveLength(1)
  })

  it('announces the conflict to assistive technology', () => {
    const wrapper = mountNotice({ recovery: null, conflict: '冲突' })

    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })
})
