'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@apollo/client';
import { Avatar, Button, Input, List, Popconfirm, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useUser } from '@/components/UserContext';
import { useLanguage } from '@/components/LanguageContext';
import {
  ADD_COMMENT_MUTATION,
  DELETE_COMMENT_MUTATION,
} from '@/graphql/operations';
import styles from './CommentsSection.module.css';

export type CommentItem = {
  id: string;
  userName: string;
  text: string;
  createdAt: string;
  imageUrl: string | null;
  isMine: boolean;
};

type Props = {
  tortillaId: string;
  comments: CommentItem[];
  /** Llamado tras añadir o borrar para refrescar la query padre. */
  onChanged: () => void | Promise<unknown>;
};

const MAX_LENGTH = 500;

export function CommentsSection({ tortillaId, comments, onChanged }: Props) {
  const { userName } = useUser();
  const { t, locale } = useLanguage();
  const [draft, setDraft] = useState('');
  const [addComment, { loading: adding }] = useMutation(ADD_COMMENT_MUTATION);
  const [deleteComment] = useMutation(DELETE_COMMENT_MUTATION);

  async function handleSubmit() {
    const text = draft.trim();
    if (!text) return;
    try {
      await addComment({ variables: { input: { tortillaId, text } } });
      setDraft('');
      await onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('comments.errorPost');
      message.error(msg);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteComment({ variables: { id } });
      await onChanged();
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('comments.errorDelete');
      message.error(msg);
    }
  }

  function formatTime(date: string): string {
    try {
      return new Date(date).toLocaleString(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return date;
    }
  }

  return (
    <section className={styles.wrap} aria-label={t('comments.title')}>
      <h3 className={styles.title}>
        {t('comments.title')}{' '}
        <span className={styles.count}>({comments.length})</span>
      </h3>

      <List
        dataSource={comments}
        locale={{ emptyText: t('comments.empty') }}
        renderItem={(c) => {
          const profileHref = `/profile/${encodeURIComponent(c.userName)}`;
          return (
            <List.Item
              className={styles.item}
              actions={
                c.isMine
                  ? [
                      <Popconfirm
                        key="del"
                        title={t('comments.deleteConfirm')}
                        okText={t('comments.deleteOk')}
                        cancelText={t('comments.deleteCancel')}
                        onConfirm={() => handleDelete(c.id)}
                      >
                        <Button
                          type="text"
                          size="small"
                          icon={<DeleteOutlined />}
                          aria-label={t('comments.deleteOk')}
                        />
                      </Popconfirm>,
                    ]
                  : undefined
              }
            >
              <List.Item.Meta
                avatar={
                  <Link href={profileHref} aria-label={c.userName}>
                    <Avatar
                      src={c.imageUrl ?? undefined}
                      style={{
                        backgroundColor: 'var(--color-tortilla-500)',
                        color: 'white',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {c.userName.charAt(0).toUpperCase()}
                    </Avatar>
                  </Link>
                }
                title={
                  <div className={styles.itemHeader}>
                    <Link href={profileHref} className={styles.author}>
                      {c.userName}
                    </Link>
                    <span className={styles.timestamp}>
                      {formatTime(c.createdAt)}
                    </span>
                  </div>
                }
                description={<p className={styles.text}>{c.text}</p>}
              />
            </List.Item>
          );
        }}
      />

      {userName ? (
        <div className={styles.form}>
          <Input.TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('comments.placeholder')}
            autoSize={{ minRows: 2, maxRows: 5 }}
            maxLength={MAX_LENGTH}
            showCount
            disabled={adding}
          />
          <Button
            type="primary"
            onClick={handleSubmit}
            loading={adding}
            disabled={!draft.trim()}
            className={styles.submit}
          >
            {t('comments.post')}
          </Button>
        </div>
      ) : (
        <p className={styles.loginHint}>{t('comments.loginToPost')}</p>
      )}
    </section>
  );
}
