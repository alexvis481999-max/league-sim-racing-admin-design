import { EmptyState, Notice, PageHeader, Panel, RowItem, usePageChrome } from '../../ui/v16';

/** No achievements API exists yet: the page states that honestly and offers no create/grant commands. */
export function AchievementsPage() {
  usePageChrome({ crumbs: [{ label: 'Достижения' }] });
  return (
    <>
      <PageHeader overline="Администрирование" title="Достижения" description="Состояние раздела и структура будущего интерфейса" />
      <div className="lsr-cols-module">
        <Panel title="Раздел в админке">
          <EmptyState title="Пока нет функций управления">
            API достижений в админке не подключено. Каталог, выдача, ручное начисление и аудит достижений появятся здесь, когда сервер начнёт их отдавать.
          </EmptyState>
        </Panel>
        <Panel title="Что понадобится">
          <div className="lsr-rows">
            <RowItem title="Шаблоны достижений" aside={<span className="lsr-muted">Название, условие, визуал</span>} />
            <RowItem title="Выдачи пилотам" aside={<span className="lsr-muted">Источник, дата, участник</span>} />
            <RowItem title="История изменений" aside={<span className="lsr-muted">Кто и почему изменил</span>} />
          </div>
          <div style={{ marginTop: 16 }}>
            <Notice tone="warning">Это структура будущего раздела, а не подтверждённая бизнес-логика. Кнопок «Создать» и «Выдать» нет, пока нет API.</Notice>
          </div>
        </Panel>
      </div>
    </>
  );
}
