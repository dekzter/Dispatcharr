import React from 'react';
import ChannelsTable from '../components/tables/ChannelsTable';
import StreamsTable from '../components/tables/StreamsTable';
import { Box } from '@mantine/core';
import { Allotment } from 'allotment';
import { USER_LEVELS } from '../constants';
import useAuthStore from '../store/auth';

const ChannelsPage = () => {
  const authUser = useAuthStore((s) => s.user);

  if (authUser.user_level <= USER_LEVELS.READ_ONLY) {
    return (
      <Box style={{ padding: 10 }}>
        <ChannelsTable />
      </Box>
    );
  }

  return (
    <div style={{ height: '100vh', width: '100%', display: 'flex' }}>
      <Allotment
        defaultSizes={[50, 50]}
        style={{ height: '100%', width: '100%' }}
        className="custom-allotment"
      >
        <div style={{ padding: 10 }}>
          <ChannelsTable />
        </div>
        <div style={{ padding: 10 }}>
          <StreamsTable />
        </div>
      </Allotment>
    </div>
  );
};

export default ChannelsPage;
