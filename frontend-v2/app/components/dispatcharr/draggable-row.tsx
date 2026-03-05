import useChannelsTableStore from '@/store/channelsTable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

export const DraggableRowWrapper = ({
  row,
  children,
  style = {},
  enableDragDrop = false,
}) => {
  const isUnlocked = useChannelsTableStore((s) => s.isUnlocked);
  const shouldEnableDrag = enableDragDrop && isUnlocked;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    disabled: !shouldEnableDrag,
  });

  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
    ...style,
  };

  return (
    <div ref={setNodeRef} style={dragStyle}>
      {shouldEnableDrag && (
        <div
          {...attributes}
          {...listeners}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            zIndex: 1,
          }}
        >
          <GripVertical size={16} opacity={0.5} />
        </div>
      )}
      <div style={{ paddingLeft: shouldEnableDrag ? 28 : 0, width: '100%' }}>
        {children}
      </div>
    </div>
  );
};

export const DraggableRow = ({ row, children }) => {
  const isUnlocked = useChannelsTableStore((s) => s.isUnlocked);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: row.id,
    disabled: !isUnlocked,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: 'relative',
  };

  return (
    <div ref={setNodeRef} style={style} className="tr">
      {isUnlocked && (
        <div
          {...attributes}
          {...listeners}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRight: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 1,
          }}
        >
          <GripVertical size={16} opacity={0.5} />
        </div>
      )}
      <div style={{ paddingLeft: isUnlocked ? 28 : 0, width: '100%' }}>
        {children}
      </div>
    </div>
  );
};
