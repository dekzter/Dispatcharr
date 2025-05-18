// Modal.js
import React, { useState, useEffect } from 'react';
import API from '../../api';
import useEPGsStore from '../../store/epgs';
import {
  LoadingOverlay,
  TextInput,
  Button,
  Checkbox,
  Modal,
  Flex,
  NativeSelect,
  NumberInput,
  Space,
  Select,
  PasswordInput,
  Box,
  Group,
  Stack,
  MultiSelect,
} from '@mantine/core';
import { isNotEmpty, useForm } from '@mantine/form';
import useUsersStore from '../../store/users';
import useChannelsStore from '../../store/channels';
import { USER_LEVELS, USER_LEVEL_LABELS } from '../../constants';

const User = ({ user = null, isOpen, onClose }) => {
  const profiles = useChannelsStore((s) => s.profiles);

  console.log(user);

  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      username: '',
      email: '',
      user_level: '0',
      current_password: '',
      password: '',
      password_repeat: '',
      channel_profiles: [],
    },

    validate: (values) => ({
      username: !values.username
        ? 'Username is required'
        : values.user_level == USER_LEVELS.STREAMER &&
            !values.username.match(/^[a-z0-9]+$/i)
          ? 'Streamer username must be alphanumeric'
          : null,
      password:
        !user && !values.password
          ? 'Password is requried'
          : values.user_level == USER_LEVELS.STREAMER &&
              !user &&
              !values.password.match(/^[a-z0-9]+$/i)
            ? 'Streamer password must be alphanumeric'
            : null,
    }),
  });

  const onSubmit = async () => {
    const values = form.getValues();

    if (!user) {
      await API.createUser(values);
    } else {
      if (!values.password) {
        delete values.password;
      }

      await API.updateUser(user.id, values);
    }

    form.reset();
    onClose();
  };

  useEffect(() => {
    if (user) {
      form.setValues({
        username: user.username,
        email: user.email,
        user_level: `${user.user_level}`,
        channel_profiles: user.channel_profiles.map((id) => `${id}`),
      });
    } else {
      form.reset();
    }
  }, [user]);

  if (!isOpen) {
    return <></>;
  }

  console.log(user);

  return (
    <Modal opened={isOpen} onClose={onClose} title="User" size="xl">
      <form onSubmit={form.onSubmit(onSubmit)}>
        <Group justify="space-between" align="top">
          <Stack gap="xs" style={{ flex: 1 }}>
            <TextInput
              id="username"
              name="username"
              label="Username"
              {...form.getInputProps('username')}
              key={form.key('username')}
            />

            <TextInput
              id="email"
              name="email"
              label="E-Mail"
              {...form.getInputProps('email')}
              key={form.key('email')}
            />

            <PasswordInput
              label="Password"
              {...form.getInputProps('password')}
              key={form.key('password')}
            />
          </Stack>

          <Stack gap="xs" style={{ flex: 1 }}>
            <Select
              label="User Level"
              data={Object.entries(USER_LEVELS).map(([label, value]) => {
                return {
                  label: USER_LEVEL_LABELS[value],
                  value: `${value}`,
                };
              })}
              {...form.getInputProps('user_level')}
              key={form.key('user_level')}
            />

            <MultiSelect
              label="Channel Profiles"
              {...form.getInputProps('channel_profiles')}
              key={form.key('channel_profiles')}
              data={Object.values(profiles)
                .filter((profile) => profile.id != 0)
                .map((profile) => ({
                  label: profile.name,
                  value: `${profile.id}`,
                }))}
            />
          </Stack>
        </Group>

        <Flex mih={50} gap="xs" justify="flex-end" align="flex-end">
          <Button
            type="submit"
            variant="contained"
            disabled={form.submitting}
            size="small"
          >
            Save
          </Button>
        </Flex>
      </form>
    </Modal>
  );
};

export default User;
