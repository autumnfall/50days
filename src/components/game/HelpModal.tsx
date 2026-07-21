import { CONFIG, UNITS, WALL_ABSORB_PER, TOWER_DMG } from '@/game/config'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-amber-200">{title}</h3>
      <div className="mt-1.5 space-y-1 text-xs leading-relaxed text-stone-300">{children}</div>
    </div>
  )
}

export default function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-stone-600 bg-stone-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-stone-700 bg-stone-900/95 px-6 py-4 backdrop-blur">
          <h2 className="text-lg font-black tracking-widest text-amber-200">📖 游戏规则</h2>
          <button onClick={onClose} className="rounded-lg bg-stone-800 px-3 py-1 text-sm text-stone-300 hover:bg-stone-700">✕</button>
        </div>

        <div className="space-y-5 px-6 py-5">
          <Section title="🎯 目标">
            <p>坚守 <b className="text-amber-300">{CONFIG.totalDays} 天</b>，等待王国援军。人口（村民+士兵）全部死亡即战败。</p>
          </Section>

          <Section title="📯 敌军波次（随机来袭）">
            <p>· 第 {CONFIG.firstWaveDay} 天起，每天清晨有概率遭遇下一波敌军：<b className="text-orange-300">初始 20%，每过一天 +20%，第 5 天必来</b>。</p>
            <p>· 因此<b>总波数并不固定</b>（平均约 15~20 波），顶部预警会显示明日来袭概率。</p>
            <p>· 每一波敌军的数量、生命、攻击都会按<b className="text-red-300">指数增长</b>——越到后期越恐怖，切勿拖延备战。</p>
          </Section>

          <Section title="👥 人口与住房">
            <p>· 总人口 = 村民 + 士兵，受住房上限限制（民居 +{CONFIG.houseCapPer}）。</p>
            <p>· <b>训练士兵是 1:1 转化</b>（村民→士兵，总人口不变），所以训练<b>不需要</b>空余住房。</p>
            <p>· 只有<b>招募新村民</b>（流民/事件）才会增加总人口，需要空余住房。</p>
          </Section>

          <Section title="🌾 食物消耗">
            <p>· 村民每天 <b>{CONFIG.villagerUpkeep}</b> 食物；士兵吃得更多：
              {Object.values(UNITS).map((u) => ` ${u.icon}${u.name} ${u.upkeep}`).join('，')}。</p>
            <p>· 食物耗尽触发<b className="text-red-300">饥荒</b>：每 {CONFIG.starveRatio} 点缺口饿死 1 人（先村民后士兵）。</p>
          </Section>

          <Section title="⚔️ 战斗与战损规则">
            <p>· 战斗逐轮进行：我方伤害 = 全体士兵攻击 + 箭塔（每座 {TOWER_DMG}/轮），±10% 浮动，随机击杀敌人。</p>
            <p>· 敌方伤害先被<b>城墙</b>吸收（每级 {WALL_ABSORB_PER} 点）；城墙被打穿则<b>整段损毁（等级清零）</b>。</p>
            <p>· 城墙耗尽后，伤害随机分配给我方士兵个体，<b>生命归零即阵亡</b>（损失的兵种和数量会在战报中列出）。</p>
            <p className="rounded-lg bg-red-950/40 p-2.5">
              <b className="text-red-300">若战斗结束时仍有敌人存活（防线被突破），残敌将劫掠村庄：</b><br />
              · 村民遇害：<b>⌈残敌数 × 60%⌉</b><br />
              · 随机 <b>1 座建筑</b>被拆毁 1 级（农场/伐木场/矿场/民居/兵营均有可能）<br />
              · 箭塔被拆：<b>⌈残敌数 × 20%⌉</b>
            </p>
            <p>· 全歼敌人则<b>无一建筑损失</b>，并缴获金币与 🏅荣耀（用于解锁技能树）。</p>
          </Section>

          <Section title="🎲 随机事件">
            <p>· 每天约 40% 概率触发事件，需在 2~3 个选项中抉择——资源交换、少量损失消灾、或付出代价换取兵力/荣耀。</p>
            <p>· 事件数值<b className="text-orange-300">随天数增长</b>：资源类 ×(1+0.04×天数)，第 50 天约为第 1 天的 3 倍；村民/士兵/荣耀类每 15 天 +1。</p>
            <p>· 部分选项有前置条件（资源/士兵不足时锁定并显示原因）。</p>
          </Section>

          <Section title="✨ 技能树（3 列 × 3 层）">
            <p>· 每个文明拥有 <b>3 列专属科技</b>，每列 T1→T2→T3 依次前置解锁，费用 2 / 4 / 6 🏅荣耀，全树点满共 36 荣耀。</p>
            <p>· 荣耀点通过战斗胜利、事件抉择获得。</p>
          </Section>

          <Section title="♾️ 终局机制（解锁任意 T3 后开放）">
            <p>· <b>无限升级</b>：生产建筑 / 防御建筑 / 军队 三条路线可无限升级，第 n 级费用 2ⁿ 荣耀（1→2→4→8→16…）。</p>
            <p>· <b>资源兑换荣耀</b>：食物/木材/金币可兑换荣耀，初始 100 → 1 荣耀，每兑换一次该资源费用翻倍（100→200→400…）。商业联邦「黄金水道」可享 75 折。</p>
          </Section>
        </div>
      </div>
    </div>
  )
}
