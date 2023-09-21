import React from 'react';
import Display from 'components-react/shared/Display';
import styles from 'components-react/root/StudioEditor.m.less';
import { ERenderingMode } from '../../../obs-api';
import { Services } from 'components-react/service-provider';
import { useChildWindowParams } from 'components-react/hooks';
import { EventHandlers } from 'components-react/root/StudioEditor';
import cx from 'classnames';

export default function VerticalDisplayPopout() {
  // event handlers can't be passed as params
  const eventHandlers: EventHandlers = useChildWindowParams('eventHandlers');
  const sourceId: string = useChildWindowParams('sourceId');

  return (
    <div
      className={cx(styles.studioEditorDisplayContainer, 'noselect')}
      style={{ cursor: Services.EditorService.state.cursor }}
      onMouseDown={(event: React.MouseEvent) => eventHandlers.onMouseDown(event, 'vertical')}
      onMouseUp={(event: React.MouseEvent) => eventHandlers.onMouseUp(event, 'vertical')}
      onMouseEnter={(event: React.MouseEvent) => eventHandlers.onMouseEnter(event, 'vertical')}
      onMouseMove={(event: React.MouseEvent) => eventHandlers.onMouseMove(event, 'vertical')}
      onDoubleClick={(event: React.MouseEvent) => eventHandlers.onMouseDblClick(event, 'vertical')}
      onContextMenu={eventHandlers.onContextMenu}
    >
      <Display
        id="vertical-display-popout"
        type="vertical"
        drawUI={true}
        paddingSize={10}
        onOutputResize={(rect: IRectangle) => eventHandlers.onOutputResize(rect, 'vertical')}
        renderingMode={ERenderingMode.OBS_MAIN_RENDERING}
        sourceId={sourceId}
      />
    </div>
  );
}
