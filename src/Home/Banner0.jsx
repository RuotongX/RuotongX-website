import React from 'react';
import { Button } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import QueueAnim from 'rc-queue-anim';
import TweenOne from 'rc-tween-one';
import { isImg } from './utils';




class Banner extends React.PureComponent {
  render() {

    const { ...currentProps } = this.props;
    const { dataSource } = currentProps;
    delete currentProps.dataSource;
    delete currentProps.isMobile;
    return (

      <div {...currentProps} {...dataSource.wrapper}>

        <QueueAnim
          key="QueueAnim"
          type={['bottom', 'top']}
          delay={200}
          {...dataSource.textWrapper}
        >
            <div style={{textAlign: "center"}}>
          <div key="title" {...dataSource.title} >
            {typeof dataSource.title.children === 'string' &&
            dataSource.title.children.match(isImg) ? (
              <img src={dataSource.title.children} width="100%" alt="img" />
            ) : (
              dataSource.title.children
            )}
          </div>
                </div>
          <div key="content" {...dataSource.content}>
            {dataSource.content.children}
          </div>
            <div style={{textAlign: "center"}}>
          <Button type="ghost" key="button" {...dataSource.button} onClick={(e) =>{
              e.preventDefault();
              window.location.href='https://github.com/RuotongX/Namer';
          }}>
            {dataSource.button.children}
          </Button>
                </div>
        </QueueAnim>
        <TweenOne
          animation={{
            y: '-=20',
            yoyo: true,
            repeat: -1,
            duration: 1000,
          }}
          className="banner0-icon"
          key="icon"
        >
          <DownOutlined />
        </TweenOne>
      </div>
    );
  }
}
export default Banner;
