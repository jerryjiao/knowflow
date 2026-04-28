# Karpathy: Neural Networks Zero to Hero

> 📊 原文: [neural-networks-zero-to-hero - GitHub](https://github.com/karpathy/ng-video-lecture)

## 概述

Andrej Karpathy（前 Tesla AI 总监、OpenAI 创始成员）的《Neural Networks: Zero to Hero》视频课程系列。从零开始手写神经网络，深入理解深度学习的每一个细节。

## 课程结构

### Video 1: Introduction to Neural Networks
- 从最简单的神经元开始
- 前向传播、反向传播的手工推导
- 微积分直觉：梯度下降为什么有效
- **核心观点**: 不依赖框架，从数学第一原理理解 NN

### Video 2: Making Phase More Pass
- 构建 makemore（字符级语言模型）
- Bigram 模型 → MLP → RNN
- 逐步增加复杂度
- **教学风格**: "让代码跑通，再解释为什么"

### Video 3: Building Micrograd
- 从零实现自动微分引擎
- 理解反向传播的本质
- 计算图的可视化
- **价值**: 理解 PyTorch/TensorFlow 底层原理

### Video 4: Backpropagation
- 深入链式法则
- 矩阵微分的直观理解
- 为什么反向传播高效
- **经典内容**: CS231n 风格的清晰讲解

### Video 5: Making GPT from Scratch
- 从零实现 GPT-2 架构
- Attention mechanism 手写
- Transformer 的每一行代码
- **高潮部分**: 完整训练循环

### Video 6: BatchNorm, Residuals, etc.
- 现代 NN 训练技巧
- BatchNorm、LayerNorm、Residual connections
- 为什么这些 trick 有效
- **实用价值**: 训练稳定性的关键

### Video 7: Tokenization
- BPE（Byte Pair Encoding）详解
- tokenizer 的艺术和陷阱
- 特殊 token 的作用
- **被忽视的重要话题**

### Video 8: Loading & Data
- 数据加载的最佳实践
- DataLoader 设计
- 分布式训练的数据管道

## Karpathy 的教学理念

### "Software 2.0"
- 传统编程 1.0：人写逻辑
- 深度学习 2.0：数据定义行为，优化找代码
- **对 KnowFlow 的启发**: Wiki 编译也是 Software 2.0 思维

### 第一原理思考
- 不接受黑箱，拆解到底层
- 用代码验证直觉
- **Karpathy 原话**: "I don't believe anything until I've coded it myself"

### 极简主义
- 最少的依赖，最大的理解
- 优先 Python 原生 + numpy
- **代码美学**: 优雅的简单

## 对 KnowFlow 的启示

### 知识编译的方法论
- Karpathy 的教程本身就是"知识编译"的典范
- 将复杂的学术内容编译为可理解的教程
- **KnowFlow 可以借鉴这种"从零到英雄"的结构**

### LLM Wiki 的起源
- Karpathy 的 [llm.wiki](https://github.com/karpathy/llm.wiki) Gist 是 KnowFlow 的核心理念来源
- **编译一次，持续维护** — 与本课程的教学哲学一致

### 技术栈影响
- 理解 NN 基础有助于理解 LLM 的能力和局限
- 对 Wiki 内容的质量判断有指导意义

## 相关链接
[[sources/lilianweng-llm-agents]] | [[concepts/ai辅助学习]] | [[concepts/llm-wiki-methodology]]
