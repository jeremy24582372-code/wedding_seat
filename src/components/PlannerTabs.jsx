import './AppShell.css';

export default function PlannerTabs({ tabs, activeTab, onChange }) {
  return (
    <nav className="planner-tabs" aria-label="排座工作台分頁">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={`planner-tabs__item${activeTab === tab.id ? ' planner-tabs__item--active' : ''}`}
          onClick={() => onChange(tab.id)}
          aria-current={activeTab === tab.id ? 'page' : undefined}
        >
          <span className="planner-tabs__label">{tab.label}</span>
          {tab.meta ? <span className="planner-tabs__meta">{tab.meta}</span> : null}
        </button>
      ))}
    </nav>
  );
}
