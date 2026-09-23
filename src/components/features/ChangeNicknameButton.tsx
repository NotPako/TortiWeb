'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { useSession } from 'next-auth/react';
import { Alert, Button, Form, Input, Modal, Tooltip, message } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { useLanguage } from '@/components/LanguageContext';
import {
  CHANGE_NICKNAME_MUTATION,
  ME_QUERY,
  MY_NICKNAME_QUERY,
  MY_STATS_QUERY,
} from '@/graphql/operations';
import { MAX_NICKNAME_CHANGES, NICKNAME_RE } from '@/lib/nickname';

type MyNickname = {
  me: { id: string; username: string; nicknameChangesLeft: number } | null;
};

type Values = { username: string };

/**
 * Cambiar de nombre desde el perfil propio.
 *
 * El aviso de cuántos cambios quedan va dentro del modal y no en el botón: es
 * la información que hace falta **antes** de confirmar, no al mirar el perfil.
 */
export function ChangeNicknameButton() {
  const { t } = useLanguage();
  const { update } = useSession();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form] = Form.useForm<Values>();

  const { data } = useQuery<MyNickname>(MY_NICKNAME_QUERY);
  const left = data?.me?.nicknameChangesLeft ?? MAX_NICKNAME_CHANGES;
  const current = data?.me?.username ?? '';

  const [changeNickname, { loading }] = useMutation(CHANGE_NICKNAME_MUTATION, {
    // El nombre aparece en la navbar, en las estadísticas y en cada voto.
    refetchQueries: [{ query: ME_QUERY }, { query: MY_STATS_QUERY }],
    awaitRefetchQueries: true,
  });

  function openModal() {
    setError(null);
    form.setFieldsValue({ username: current });
    setOpen(true);
  }

  async function handleSubmit(values: Values) {
    setError(null);
    try {
      await changeNickname({ variables: { username: values.username.trim() } });
      // Refresca la sesión de NextAuth: el JWT todavía lleva el nombre viejo.
      await update();
      setOpen(false);
      message.success(t('nickname.success'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.errorPrefix'));
    }
  }

  const exhausted = left === 0;

  const button = (
    <Button
      size="small"
      icon={<EditOutlined />}
      onClick={openModal}
      disabled={exhausted}
    >
      {t('nickname.change')}
    </Button>
  );

  return (
    <>
      {exhausted ? (
        <Tooltip title={t('nickname.exhausted')}>
          <span>{button}</span>
        </Tooltip>
      ) : (
        button
      )}

      <Modal
        open={open}
        title={t('nickname.title')}
        onCancel={() => setOpen(false)}
        okText={t('nickname.submit')}
        cancelText={t('common.cancel')}
        confirmLoading={loading}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          message={
            left === 1
              ? t('nickname.remainingOne')
              : t('nickname.remaining', { n: left, max: MAX_NICKNAME_CHANGES })
          }
          description={t('nickname.warning')}
          style={{ marginBottom: 16 }}
        />
        <Form<Values>
          form={form}
          layout="vertical"
          requiredMark={false}
          onFinish={handleSubmit}
          preserve={false}
        >
          <Form.Item
            label={t('nickname.label')}
            name="username"
            rules={[
              {
                required: true,
                whitespace: true,
                pattern: NICKNAME_RE,
                message: t('nickname.invalid'),
              },
            ]}
          >
            <Input autoFocus maxLength={20} autoComplete="off" />
          </Form.Item>
          {error ? <Alert type="error" message={error} showIcon /> : null}
        </Form>
      </Modal>
    </>
  );
}
