import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Sidebar labels are translated per locale via `translations`; the `← Website`
// link points at the English landing, which auto-redirects zh browsers to /zh/.
const withZh = (en, zh) => ({ label: en, translations: { zh, 'zh-CN': zh } });

export default defineConfig({
  site: 'https://jerryjiao.github.io',
  base: '/knowflow/',
  integrations: [
    starlight({
      title: 'KnowFlow',
      description: 'Agent-native Markdown knowledge workspace: capture sources, organize linked wikis, explore graphs.',
      favicon: './src/assets/favicon.svg',
      defaultLocale: 'en',
      locales: {
        en: { label: 'English', lang: 'en' },
        zh: { label: '简体中文', lang: 'zh-CN' },
      },
      sidebar: [
        { ...withZh('← Website', '← 官网'), link: '/knowflow/' },
        { ...withZh('Introduction', '简介'), slug: 'intro' },
        { ...withZh('Quickstart', '快速开始'), slug: 'quickstart' },
        { ...withZh('Use with an AI assistant', '配合 AI 助手使用'), slug: 'agent-guide' },
        { ...withZh('Commands', '命令参考'), slug: 'commands' },
        { ...withZh('Architecture', '系统架构'), slug: 'architecture' },
        { ...withZh('Data model', '数据模型'), slug: 'data-model' },
        { ...withZh('Methodology', '方法论'), slug: 'methodology' },
        { ...withZh('FAQ', '常见问题'), slug: 'faq' },
        { ...withZh('Contributing', '贡献指南'), slug: 'contributing' },
      ],
      social: [
        { label: 'GitHub', icon: 'github', href: 'https://github.com/jerryjiao/knowflow' },
      ],
      customCss: ['./src/styles/starlight-brand.css'],
    }),
  ],
});
