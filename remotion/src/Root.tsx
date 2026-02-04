import { Composition } from "remotion";
import { SubwayTakesDemo } from "./SubwayTakesDemo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SubwayTakesDemo"
        component={SubwayTakesDemo}
        durationInFrames={1800} // 60 seconds at 30fps
        fps={30}
        width={1080}
        height={1920} // Vertical video for TikTok/Reels
        defaultProps={{}}
      />
    </>
  );
};
