import React from 'react';
import PostDetail from './PostDetail';

/** COMMONS 상세(/commons/:id) — 작품 상세와 같은 판식을 쓴다(지시 5항). 내용은 DB /api/filed. */
const CommonsDetail: React.FC = () => <PostDetail kind="filed" base="/commons" label="COMMONS" />;

export default CommonsDetail;
