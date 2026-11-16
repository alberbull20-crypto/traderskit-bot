import './coming-soon.scss';

type TComingSoonProps = {
    title: string;
    text: string;
};

const ComingSoon = ({ title, text }: TComingSoonProps) => (
    <div className='coming-soon'>
        <div className='coming-soon__card'>
            <span className='coming-soon__label'>Coming soon</span>
            <h2>{title}</h2>
            <p>{text}</p>
        </div>
    </div>
);

export default ComingSoon;
