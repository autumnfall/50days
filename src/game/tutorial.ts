// ============================================================
// 教程系统 —— 步骤定义与持久化
// ============================================================

export interface TutorialStep {
  id: string
  target: string | null // CSS selector, null = centered
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
}

const STORAGE_KEY = 'fiftyDays_tutorialCompleted'

export function isTutorialCompleted(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
}

export function markTutorialCompleted() {
  try { localStorage.setItem(STORAGE_KEY, 'true') } catch { /* 存储不可用 */ }
}

export function resetTutorial() {
  localStorage.removeItem(STORAGE_KEY)
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    target: null,
    title: '🏰 欢迎来到「五十日坚守」',
    content: '你的目标是带领村庄存活 50 天。每天你需要分配村民采集资源、建造建筑、训练士兵，抵御不断增强的敌军。让我们先了解一下各个面板的功能。',
  },
  {
    id: 'resources',
    target: '[data-tutorial="resources"]',
    title: '🌾 资源',
    content: '这里有三种资源：食物（🌾）维持村民生存，木材（🪵）用于建造，金币（🪙）用于训练士兵和交易。下方的 🏅 荣耀用于解锁技能树。',
    placement: 'bottom',
  },
  {
    id: 'assignment',
    target: '[data-tutorial="assignment-panel"]',
    title: '🧑‍🌾 村民分配',
    content: '将村民分配到食物、木材、金币的采集岗位。注意空闲村民数量——你需要合理分配，确保食物收入能覆盖每日消耗。',
    placement: 'right',
  },
  {
    id: 'end-turn',
    target: '[data-tutorial="end-turn"]',
    title: '⏭ 结束回合',
    content: '准备好后点击这里进入下一天。系统会结算资源收入与消耗，处理随机事件，并判断是否有敌军来袭。第 3 天起每天有概率遭遇敌军！',
    placement: 'top',
  },
  {
    id: 'build',
    target: '[data-tutorial="build-panel"]',
    title: '🔨 建造与招募',
    content: '建造农场、伐木场、矿场提升资源产出；民居增加住房上限；兵营解锁士兵训练；城墙和箭塔增强防御。你也可以在这里招募新村民。',
    placement: 'left',
  },
  {
    id: 'army',
    target: '[data-tutorial="army-panel"]',
    title: '🎖️ 军队训练',
    content: '将村民训练为士兵来抵御敌军。民兵（兵营 Lv1）基础但廉价，弓手（Lv2）远程输出，骑士（Lv3）强力近战。训练是 1:1 转化，不需要额外住房。',
    placement: 'right',
  },
  {
    id: 'skill-tree',
    target: '[data-tutorial="skill-tree"]',
    title: '✨ 技能树',
    content: '通过战斗胜利和事件获得荣耀点，在这里解锁强力技能。每个文明有 3 条专属科技路线，需要依次解锁（T1→T2→T3）。解锁任意 T3 后开放终局机制。',
    placement: 'left',
  },
  {
    id: 'wave-warning',
    target: '[data-tutorial="wave-warning"]',
    title: '📯 波次预警',
    content: '这里显示下一波敌军的信息和来袭概率。概率从第 3 天的 20% 开始，每天增加 20%，第 5 天必定来袭。注意"战力不足"的警告！',
    placement: 'bottom',
  },
  {
    id: 'ready',
    target: null,
    title: '✅ 你已准备就绪',
    content: '基本规则就这些！善用右上角的 ❓ 按钮查看详细规则。记住：合理分配资源、及时建造防御、在关键波次前训练足够的士兵。祝你好运！',
  },
]
