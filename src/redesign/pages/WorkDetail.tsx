import React from 'react';
import PostDetail from './PostDetail';

/** ART WORK 상세(/work/:id) — 판식은 work.html, 내용은 DB /api/work. */
const WorkDetail: React.FC = () => <PostDetail kind="work" base="/work" label="ART WORK" />;

export default WorkDetail;
