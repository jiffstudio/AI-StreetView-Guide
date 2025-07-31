"use client";

import dynamic from "next/dynamic";

import AuthInitializer from "@/components/authInitializer";
import { useAppSelector, EMobileActiveTab, useIsCompactLayout } from "@/common";
import Header from "@/components/Layout/Header";
import Action from "@/components/Layout/Action";
import { cn } from "@/lib/utils";
import Avatar from "@/components/Agent/AvatarTrulience";
import React from "react";
import { IRtcUser, IUserTracks } from "@/manager";
import { IMicrophoneAudioTrack } from "agora-rtc-sdk-ng";

const DynamicRTCCard = dynamic(() => import("@/components/Dynamic/RTCCard"), {
  ssr: false,
});
const DynamicChatCard = dynamic(() => import("@/components/Chat/ChatCard"), {
  ssr: false,
});
const DynamicStreetViewMap = dynamic(() => import("@/components/StreetView/StreetViewMap"), {
  ssr: false,
});

export default function Home() {
  const [isClient, setIsClient] = React.useState(false);
  const mobileActiveTab = useAppSelector(
    (state) => state.global.mobileActiveTab
  );
  const trulienceSettings = useAppSelector((state) => state.global.trulienceSettings);

  const isCompactLayout = useIsCompactLayout();
  const useTrulienceAvatar = trulienceSettings.enabled;
  const avatarInLargeWindow = trulienceSettings.avatarDesktopLargeWindow;
  const [remoteuser, setRemoteUser] = React.useState<IRtcUser>()

  // 确保只在客户端渲染动态内容
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  React.useEffect(() => {
    const { rtcManager } = require("../manager/rtc/rtc");
    rtcManager.on("remoteUserChanged", onRemoteUserChanged);
    return () => {
      rtcManager.off("remoteUserChanged", onRemoteUserChanged);
    };
  }, []);

  const onRemoteUserChanged = (user: IRtcUser) => {
    if (useTrulienceAvatar) {
      user.audioTrack?.stop();
    }
    if (user.audioTrack) {
      setRemoteUser(user)
    } 
  }

  return (
    <AuthInitializer>
      <div className="relative mx-auto flex flex-1 min-h-screen flex-col md:h-screen">
        <Header className="h-[60px]" />
        <Action />
        <div className={cn(
          "mx-2 mb-2 flex h-full max-h-[calc(100vh-108px-24px)] flex-col md:flex-row md:gap-2 flex-1",
          {
            ["flex-col-reverse"]: avatarInLargeWindow && isCompactLayout
          }
        )}>
          {/* Client-side only content */}
          {isClient ? (
            <>
              {/* Street View Map - Large left side */}
              <DynamicStreetViewMap
                className={cn(
                  "m-0 w-full rounded-b-lg bg-[#181a1d] md:w-[calc(100%-340px)] md:rounded-lg flex-1",
                  {
                    ["hidden md:flex"]: mobileActiveTab === EMobileActiveTab.CHAT,
                  }
                )}
              />

              {/* Right side content */}
              <div className="flex flex-col md:w-[320px] gap-2 h-full">
                {/* RTC Card - Video area with dynamic height */}
                <div className="flex-shrink-0">
                  <DynamicRTCCard
                    className={cn(
                      "m-0 w-full rounded-b-lg bg-[#181a1d] md:rounded-lg",
                      {
                        ["hidden md:flex"]: mobileActiveTab === EMobileActiveTab.CHAT,
                      }
                    )}
                  />
                </div>

                {/* Chat Card - Takes remaining space dynamically */}
                {(!useTrulienceAvatar || isCompactLayout || !avatarInLargeWindow) && (
                  <div className="flex-1 min-h-0">
                    <DynamicChatCard
                      className={cn(
                        "m-0 w-full h-full rounded-b-lg bg-[#181a1d] md:rounded-lg",
                        {
                          ["hidden md:flex"]: mobileActiveTab === EMobileActiveTab.AGENT,
                        }
                      )}
                    />
                  </div>
                )}

                {/* Avatar - if enabled */}
                {(useTrulienceAvatar && avatarInLargeWindow) && (
                  <div className="flex-1 min-h-0">
                    <div className={cn(
                      "w-full h-full bg-[#181a1d] rounded-lg p-1",
                      {
                        ["hidden md:block"]: mobileActiveTab === EMobileActiveTab.CHAT,
                      }
                    )}>
                      <Avatar audioTrack={remoteuser?.audioTrack} />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Loading placeholder with exact same structure */
            <>
              <div className="m-0 w-full rounded-b-lg bg-[#181a1d] md:w-[calc(100%-340px)] md:rounded-lg flex-1 flex items-center justify-center">
                <div className="text-gray-400">Loading Street View...</div>
              </div>
              <div className="flex flex-col md:w-[320px] gap-2 h-full">
                {/* Video placeholder with dynamic height */}
                <div className="flex-shrink-0">
                  <div className="w-full bg-[#181a1d] rounded-lg flex items-center justify-center p-8">
                    <div className="text-gray-400">Loading Video...</div>
                  </div>
                </div>
                {/* Chat placeholder */}
                <div className="flex-1 min-h-0">
                  <div className="w-full h-full bg-[#181a1d] rounded-lg flex items-center justify-center">
                    <div className="text-gray-400">Loading Chat...</div>
                  </div>
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </AuthInitializer>
  );
}
