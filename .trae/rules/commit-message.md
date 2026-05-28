---
alwaysApply: true
scene: git_message
---

# Git Commit Message 规则

## 格式要求
```
<type>(<scope>): <description>


- 第一条变更描述
- 第二条变更描述
- 第三条变更描述
```

## 类型说明
- **feat**: 新功能
- **fix**: 修复 bug
- **docs**: 文档更新
- **style**: 代码格式调整
- **refactor**: 代码重构
- **test**: 测试相关
- **chore**: 构建或辅助工具变动

## 命名规范
- 描述使用中文
- 使用现在时祈使句（如"添加"、"修复"、"更新"）
- 首行长度不超过 72 字符
- 首字母大写

## 详细描述格式要求
- 详细描述必须使用 `- ` 开头的列表形式
- 首行后必须有两个空行
- 每条变更描述独立一行
- 禁止使用数字序号（如 1. 2. 3. 或 123456）
- 禁止使用其他符号开头（如 * 或 +）

## 示例
```
feat: 完成热力图页面及相关组件开发


- 新增HeatmapChart、AttentionTree、ImageUpload、PatchGrid等业务组件
- 新增attention、chart类型定义文件，完善TS类型支持
- 封装mock数据服务与useMockData自定义Hook
- 更新todo.md文档，标记已完成任务
- 优化Loading组件的props命名与默认参数
- 完成Heatmap页面的完整业务逻辑实现，包含数据加载、布局展示与组件联动
```