# Agent Rules for Data Visualization Project Spec

## Why
数据可视化小组作业需要建立清晰的协作边界和工程标准。协作者非工程背景，而前端开发需要严格的工程规范和数据来源约束，以确保项目结构清晰、协作顺畅、避免误操作。

## What Changes
- **添加项目级别的agent rules**：定义数据来源约束和文件操作边界
- **建立web文件夹工程标准**：React + TypeScript + Ant Design + AntV技术栈规范
- **明确协作边界**：禁止修改web文件夹外的任何文件（mock文件夹除外）

## Impact
- Affected specs: agent协作规则、前端工程标准
- Affected code: `.trae/rules/project_rules.md`（新建）、web文件夹内的所有前端代码

## ADDED Requirements

### Requirement: Agent Rules - 数据来源约束
Agent SHALL 仅从根目录的mock文件夹获取数据，禁止修改web文件夹外的任何文件。

#### Scenario: Agent尝试修改根目录文件
- **WHEN** agent尝试修改根目录下的任何文件（如Python文件、图片文件等）
- **THEN** agent应拒绝操作并提示"禁止修改web文件夹外的文件，数据来源仅限mock文件夹"

#### Scenario: Agent从mock文件夹读取数据
- **WHEN** agent需要获取项目数据
- **THEN** agent应仅从根目录的mock文件夹读取，不得修改其他位置

### Requirement: Agent Rules - Web工程标准
Agent SHALL 遵循web文件夹内的React + TypeScript工程标准。

#### Scenario: 代码风格规范
- **WHEN** agent在web文件夹内编写或修改代码
- **THEN** 应遵循以下标准：
  - 使用TypeScript进行类型安全开发
  - 使用ESLint进行代码检查
  - 组件采用函数式组件 + Hooks
  - 样式采用CSS Modules或styled-components

#### Scenario: 技术栈约束
- **WHEN** agent开发可视化功能
- **THEN** 应使用：
  - UI框架：Ant Design
  - 可视化库：AntV（G2/G6/X6等）
  - 构建工具：Vite
  - 包管理：npm

### Requirement: Agent Rules - 协作边界
Agent SHALL 明确区分前端开发边界，不干预其他协作者的工作区域。

#### Scenario: 前端开发边界
- **WHEN** agent执行前端开发任务
- **THEN** 仅操作web文件夹内的文件，保持与其他协作者的工作隔离

## MODIFIED Requirements
无

## REMOVED Requirements
无
