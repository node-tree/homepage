import React, { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import { DbHeader, DbPost, Kind, monoDate } from '../db';
import ConfirmDialog from './ui/ConfirmDialog';
import { TextArea, TextInput } from './ui/fields';
import { useToast } from './ui/Toast';
import { usePostAdmin } from './usePostAdmin';

// ════════════════════════════════════════════════════════════════════════
// PostAdminList — 목록 페이지(/work · /commons)의 편집 가설물.
//   · 표제(title/subtitle) 제자리 편집
//   · 새 글 → /work/new · /commons/new
//   · 각 항목 수정/삭제 · 드래그(또는 키보드)로 순서 변경 → sortOrder 일괄 저장
//   순서는 DB 순서(sortOrder) 그대로 평평하게 편다 — 읽기 화면의 연도 묶음과 달리
//   순서 편집은 「한 줄」이어야 뜻이 분명하다.
// ════════════════════════════════════════════════════════════════════════

const SortableRow: React.FC<{
  post: DbPost;
  index: number;
  base: string;
  showCategory: boolean;
  onAskDelete: (post: DbPost) => void;
}> = ({ post, index, base, showCategory, onAskDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: post.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    position: 'relative',
    zIndex: isDragging ? 2 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className={`nte-item${isDragging ? ' dragging' : ''}`}>
      <button
        type="button"
        className="nte-grip"
        aria-label={`${post.title} 순서 옮기기`}
        {...attributes}
        {...listeners}
      >
        {String(index + 1).padStart(2, '0')}
      </button>
      <span className="nte-t">{post.title}</span>
      <span className="nte-meta">
        {showCategory ? `${post.category ?? '분류 —'} · ` : ''}
        {monoDate(post.date) || '—'}
      </span>
      <span className="nte-rowacts">
        <Link className="nte-btn" to={`${base}/${post.id}/edit`}>
          수정
        </Link>
        <button type="button" className="nte-btn warn" onClick={() => onAskDelete(post)}>
          삭제
        </button>
      </span>
    </div>
  );
};

export interface PostAdminListProps {
  kind: Kind;
  /** 목록 경로 — /work · /commons */
  base: string;
  /** Mono 표찰 — ART WORK · COMMONS */
  label: string;
  posts: DbPost[];
  header: DbHeader;
  /** 저장 후 목록 재적재 */
  onChanged: () => void;
  onHeaderSaved: (next: DbHeader) => void;
}

const PostAdminList: React.FC<PostAdminListProps> = ({
  kind,
  base,
  label,
  posts,
  header,
  onChanged,
  onHeaderSaved,
}) => {
  const toast = useToast();
  const admin = usePostAdmin(kind);
  const [order, setOrder] = useState<string[]>(() => posts.map((p) => p.id));
  const [headOpen, setHeadOpen] = useState(false);
  const [title, setTitle] = useState(header.title);
  const [subtitle, setSubtitle] = useState(header.subtitle);
  const [target, setTarget] = useState<DbPost | null>(null);

  const byId = useMemo(() => new Map(posts.map((p) => [p.id, p])), [posts]);
  const serverOrder = useMemo(() => posts.map((p) => p.id), [posts]);

  // 목록이 갱신되면(저장·삭제 후) 순서 초안을 서버 순서로 되맞춘다.
  useEffect(() => {
    setOrder(serverOrder);
  }, [serverOrder]);

  useEffect(() => {
    setTitle(header.title);
    setSubtitle(header.subtitle);
  }, [header.title, header.subtitle]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const dirty = order.join('|') !== serverOrder.join('|');

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const from = prev.indexOf(String(active.id));
      const to = prev.indexOf(String(over.id));
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

  const saveOrder = async () => {
    try {
      await admin.reorder(order);
      toast.ok(`순서를 저장했습니다 · ${order.length}건`);
      onChanged();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : '순서 저장에 실패했습니다.');
    }
  };

  const saveHeader = async () => {
    try {
      await admin.saveHeader({ title: title.trim(), subtitle });
      onHeaderSaved({ title: title.trim(), subtitle });
      setHeadOpen(false);
      toast.ok('표제를 저장했습니다.');
    } catch (e) {
      toast.err(e instanceof Error ? e.message : '표제 저장에 실패했습니다.');
    }
  };

  const doDelete = async () => {
    if (!target) return;
    const name = target.title;
    try {
      await admin.remove(target.id);
      setTarget(null);
      toast.ok(`삭제했습니다 · ${name}`);
      onChanged();
    } catch (e) {
      toast.err(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  const rows = order.map((id) => byId.get(id)).filter(Boolean) as DbPost[];

  return (
    <section className="nte-panel" aria-label={`${label} 편집`}>
      <div className="nte-in">
        <div className="nte-legend">
          <span>
            편집 EDIT · <b>{label}</b> · {posts.length}건
          </span>
          <span className="nte-acts">
            <button type="button" className="nte-btn" onClick={() => setHeadOpen((v) => !v)}>
              {headOpen ? '표제 닫기' : '표제 수정'}
            </button>
            <Link className="nte-btn pri" to={`${base}/new`}>
              새 글
            </Link>
          </span>
        </div>

        {headOpen && (
          <div style={{ marginBottom: 22 }}>
            <TextInput
              label="표제 TITLE"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={label}
            />
            <TextArea
              label="부제 SUBTITLE"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              hint="빈 줄로 문단을 나눈다. 표제 아래 註(note) 자리에 그대로 실린다."
              rows={4}
            />
            <div className="nte-acts">
              <button type="button" className="nte-btn" onClick={() => setHeadOpen(false)} disabled={admin.busy}>
                취소
              </button>
              <button type="button" className="nte-btn pri" onClick={saveHeader} disabled={admin.busy}>
                {admin.busy ? '저장 중…' : '표제 저장'}
              </button>
            </div>
          </div>
        )}

        {rows.length === 0 ? (
          <div className="nte-empty">ABSENT · 아직 글이 없습니다. 「새 글」로 첫 기록을 남기십시오.</div>
        ) : (
          <>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <div className="nte-list">
                  {rows.map((p, i) => (
                    <SortableRow
                      key={p.id}
                      post={p}
                      index={i}
                      base={base}
                      showCategory={kind === 'filed'}
                      onAskDelete={setTarget}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="nte-legend" style={{ borderBottom: 0, marginTop: 16, marginBottom: 0, paddingBottom: 0 }}>
              <span>
                순서 ORDER · {dirty ? '변경됨 — 저장해야 반영된다' : '서버와 같음'}
                <br />
                번호 단추를 끌어 옮긴다. 키보드는 Space 로 집고 ↑↓ 로 옮긴 뒤 Space 로 놓는다.
              </span>
              <span className="nte-acts">
                <button
                  type="button"
                  className="nte-btn"
                  onClick={() => setOrder(serverOrder)}
                  disabled={!dirty || admin.busy}
                >
                  되돌리기
                </button>
                <button type="button" className="nte-btn pri" onClick={saveOrder} disabled={!dirty || admin.busy}>
                  {admin.busy ? '저장 중…' : '순서 저장'}
                </button>
              </span>
            </div>
          </>
        )}
      </div>

      <ConfirmDialog
        open={!!target}
        title="이 글을 삭제합니다"
        message={
          target ? (
            <>
              「{target.title}」을(를) 삭제합니다. 되돌릴 수 없습니다.
            </>
          ) : (
            ''
          )
        }
        busy={admin.busy}
        onCancel={() => setTarget(null)}
        onConfirm={doDelete}
      />
    </section>
  );
};

export default PostAdminList;
