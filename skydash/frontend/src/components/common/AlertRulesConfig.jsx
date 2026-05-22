import { useAlertRulesStore } from '../../stores/alertRulesStore';
import GlassCard from './GlassCard';
import AlertRuleRow from './AlertRuleRow';
import AddRuleForm from './AddRuleForm';

export default function AlertRulesConfig() {
  const { rules, toggleRule, updateRule, removeRule, addRule } = useAlertRulesStore();

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <GlassCard animate={false}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] font-semibold tracking-[0.15em] text-zinc-500">
          ALERT RULES
        </h3>
        <span className="text-[9px] font-mono text-zinc-500">
          {enabledCount}/{rules.length} ACTIVE
        </span>
      </div>

      <div className="space-y-2 mb-3">
        {rules.map((rule) => (
          <AlertRuleRow
            key={rule.id}
            rule={rule}
            onToggle={toggleRule}
            onUpdate={updateRule}
            onRemove={removeRule}
          />
        ))}
      </div>

      <AddRuleForm onAdd={addRule} />
    </GlassCard>
  );
}
