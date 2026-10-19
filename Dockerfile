# ==============================================================================
# Dockerfile for NativeScript-Vue 3 on Android Emulator via budtmo/docker-android
# ==============================================================================
ARG DOCKER_ANDROID_VERSION=emulator_14.0
FROM budtmo/docker-android:${DOCKER_ANDROID_VERSION}

LABEL maintainer="Antigravity"
LABEL description="NativeScript-Vue 3 development & runtime inside Android Emulator container"

# ------------------------------------------------------------------------------
# Install Node.js LTS and NativeScript CLI (as root)
# ------------------------------------------------------------------------------
USER root

SHELL ["/bin/bash", "-c"]

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    build-essential \
    git \
 && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && npm install -g npm@latest \
 && npm install -g nativescript@latest \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Install Eclipse Temurin JDK 17 (Gradle 8 / Android Gradle Plugin requires JDK 17/21, not Java 25)
RUN mkdir -p /usr/lib/jvm \
 && curl -fsSL --retry 5 --retry-delay 3 \
      https://github.com/adoptium/temurin17-binaries/releases/download/jdk-17.0.14%2B7/OpenJDK17U-jdk_x64_linux_hotspot_17.0.14_7.tar.gz \
      | tar -xz -C /usr/lib/jvm \
 && update-alternatives --install /usr/bin/java java /usr/lib/jvm/jdk-17.0.14+7/bin/java 1 \
 && update-alternatives --set java /usr/lib/jvm/jdk-17.0.14+7/bin/java \
 && update-alternatives --install /usr/bin/javac javac /usr/lib/jvm/jdk-17.0.14+7/bin/javac 1 \
 && update-alternatives --set javac /usr/lib/jvm/jdk-17.0.14+7/bin/javac

ENV JAVA_HOME=/usr/lib/jvm/jdk-17.0.14+7
ENV PATH=${JAVA_HOME}/bin:${PATH}

# Ensure Android SDK licenses are accepted and tools permissions are set.
#
# API 35 (revision 2) requires the newer android-sdk-license hash
# d56f5187479451eabf01fb78af6dfcb131a6481e in addition to the older ones.
# Without it Gradle aborts with:
#   Failed to install the following SDK components: platforms;android-35
RUN yes | sdkmanager --licenses || true \
 && for license in /opt/android/licenses/android-sdk-license \
                 /opt/android/licenses/android-sdk-preview-license; do \
      [ -f "$license" ] || touch "$license"; \
      for hash in 24333f8a63b6825ea9c5514f83c2829b004d1fee \
                 d56f5187479451eabf01fb78af6dfcb131a6481e \
                 8933bad161af4178b1185d1a37fbf41ea5269c55; do \
        grep -q "$hash" "$license" || echo "$hash" >> "$license"; \
      done; \
    done \
 && (sdkmanager "platform-tools" "platforms;android-34" "platforms;android-35" \
             "build-tools;34.0.0" "build-tools;35.0.0" || true) \
 && chmod -R a+rwX /opt/android || true

# ------------------------------------------------------------------------------
# Set up workspace & disable telemetry
# ------------------------------------------------------------------------------
ENV WORKDIR=/home/androidusr/app
RUN mkdir -p ${WORKDIR} && chown -R androidusr:androidusr ${WORKDIR}

# The base image's emulator bootstrap runs `sudo sed -i '1d' /etc/passwd`, which
# removes the 'root' account. On the next container start `sudo` can then no
# longer resolve the root user ("sudo: unknown user root") and the emulator
# fails to boot with:
#   CalledProcessError: Command 'sudo chown 1300:1301 /dev/kvm' returned non-zero exit status 1
# Give the 'androidusr' group write access to /etc/passwd so the entrypoint can
# restore the root entry on every start.
RUN chown root:androidusr /etc/passwd && chmod 664 /etc/passwd

# Create the NativeScript build output directory with the right ownership.
# docker-compose mounts a volume over /home/androidusr/app/platforms; without
# this the volume is created root-owned and the NativeScript CLI fails with
# "EACCES: permission denied, mkdir '/home/androidusr/app/platforms/android'".
RUN mkdir -p ${WORKDIR}/platforms ${WORKDIR}/node_modules \
 && chown -R androidusr:androidusr ${WORKDIR}/platforms ${WORKDIR}/node_modules

# Copy entrypoint script
COPY --chown=androidusr:androidusr entrypoint.sh /home/androidusr/entrypoint.sh
RUN chmod +x /home/androidusr/entrypoint.sh

# Switch to non-root android user
USER androidusr
WORKDIR /home/androidusr/app

# Disable NativeScript analytics/telemetry prompts
RUN ns usage-reporting disable \
 && ns error-reporting disable

# ------------------------------------------------------------------------------
# Install project dependencies
# ------------------------------------------------------------------------------
COPY --chown=androidusr:androidusr package*.json ./
RUN npm install

# Copy application source code
COPY --chown=androidusr:androidusr . .

# ------------------------------------------------------------------------------
# Ports and Entrypoint
# 6080: noVNC web viewer (http://localhost:6080)
# 5900: VNC server
# 5554: Android emulator console
# 5555: ADB connect port
# 8080: Webpack dev server
# ------------------------------------------------------------------------------
EXPOSE 6080 5900 5554 5555 8080

ENTRYPOINT ["/home/androidusr/entrypoint.sh"]
CMD ["run"]
