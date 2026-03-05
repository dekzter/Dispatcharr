import { Button } from '@/components/ui/button';
import { SquarePlus } from 'lucide-react';

const ChannelsTableOnboarding = ({ editChannel }) => {
  return (
    <div className="w-full h-full bg-secondary flex flex-col pt-10 rounded-md">
      <div className="flex items-center justify-center">
        <div className="text-center w-1/2">
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '20px',
              lineHeight: '28px',
              letterSpacing: '-0.3px',
            }}
          >
            It’s recommended to create channels after adding your M3U or
            streams.
          </div>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: '24px',
              letterSpacing: '-0.2px',
            }}
          >
            You can still create channels without streams if you’d like, and map
            them later.
          </div>
          <Button
            leftSection={<SquarePlus size={18} />}
            variant="light"
            size="xs"
            onClick={() => editChannel()}
            color="gray"
            style={{
              marginTop: 20,
              borderWidth: '1px',
              borderColor: 'gray',
              color: 'white',
            }}
          >
            Create Channel
          </Button>
        </div>
      </div>

      <div className="flex justify-center">
        <img
          src="/ghost.svg"
          alt="Ghost"
          style={{
            paddingTop: 30,
            width: '120px',
            height: 'auto',
            opacity: 0.2,
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  );
};

export default ChannelsTableOnboarding;
