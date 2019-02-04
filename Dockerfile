FROM ubuntu:16.04

RUN export DEBIAN_FRONTEND=noninteractive \
    APT_INSTALL="apt-get install -y --no-install-recommends" && \
    PIP_INSTALL="python -m pip --no-cache-dir install --upgrade" && \
    GIT_CLONE="git clone --depth 10" && \

    apt-get update  && \
    $APT_INSTALL \
        build-essential \
        ca-certificates \
        cmake \
        wget \
        git \
        vim \
        unzip \
        && \
        $APT_INSTALL \
        software-properties-common \
        && \
    add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && \
    $APT_INSTALL \
        python3.6 \
        python3.6-dev \
        && \
    wget -O ~/get-pip.py \
        https://bootstrap.pypa.io/get-pip.py && \
    python3.6 ~/get-pip.py && \
    ln -s /usr/bin/python3.6 /usr/local/bin/python3 && \
    ln -s /usr/bin/python3.6 /usr/local/bin/python && \
    $PIP_INSTALL \
        setuptools \
        && \
    $PIP_INSTALL \
        numpy \
        scipy \
        pandas \
        scikit-learn \
        Cython \
        pillow==5.1.0 \
        flask==1.0.2 \
        gunicorn==19.9.0 \
        boto3 \
        && \
        wget -O ~/boost.tar.gz https://dl.bintray.com/boostorg/release/1.65.1/source/boost_1_65_1.tar.gz && \
        tar -zxf ~/boost.tar.gz -C ~ && \
        cd ~/boost_* && \
        ./bootstrap.sh --with-python=python3.6 && \
        ./b2 install --prefix=/usr/local && \
    $APT_INSTALL \
        libatlas-base-dev \
    libgflags-dev \
        libgoogle-glog-dev \
        libhdf5-serial-dev \
        libleveldb-dev \
        liblmdb-dev \
        libprotobuf-dev \
        libsnappy-dev \
        protobuf-compiler \
        && \
    $GIT_CLONE --branch 3.4.1 https://github.com/opencv/opencv ~/opencv && \
    mkdir -p ~/opencv/build && cd ~/opencv/build && \
    cmake -D CMAKE_BUILD_TYPE=RELEASE \
          -D CMAKE_INSTALL_PREFIX=/usr/local \
          -D WITH_IPP=OFF \
          -D WITH_CUDA=OFF \
          -D WITH_OPENCL=OFF \
          -D BUILD_TESTS=OFF \
          -D BUILD_PERF_TESTS=OFF \
          .. && \
    make -j"$(nproc)" install && \
    $GIT_CLONE --branch v19.16 https://github.com/davisking/dlib.git ~/dlib && \
    cd ~/dlib && \
    python setup.py install --no DLIB_USE_CUDA \
                            --yes USE_AVX_INSTRUCTIONS && \
    cd ~

# ==================================================================
# config & cleanup
# ------------------------------------------------------------------

RUN ldconfig && \
    apt-get clean && \
    apt-get autoremove && \
    rm -rf /var/lib/apt/lists/* /tmp/* ~/* && \
    mkdir ~/photolab_hack

RUN pip install requests \
                awscli && \
    mkdir /root/.aws

COPY ./js/* /root/photolab_hack/js/
COPY ./models/* /root/photolab_hack/models/
COPY ./static/* /root/photolab_hack/static/
COPY ./templates/* /root/photolab_hack/templates/
COPY ./Dockerfile /root/photolab_hack/
COPY ./app.py /root/photolab_hack/
COPY ./build_docker.sh /root/photolab_hack/
COPY ./face_swap.py /root/photolab_hack/
COPY ./run_docker.sh /root/photolab_hack/
COPY ./start.sh /root/photolab_hack/
COPY ./utils.py /root/photolab_hack/

RUN export AWS_PROFILE=photo-hack-gene

ENTRYPOINT ["bash"]
#CMD ["/root/photolab_hack/start.sh"]

EXPOSE 8000
